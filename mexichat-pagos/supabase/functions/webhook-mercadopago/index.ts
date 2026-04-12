// ╔══════════════════════════════════════════════════════════════╗
// ║  POST /functions/v1/webhook-mercadopago                     ║
// ║  Mercado Pago webhook handler                               ║
// ║  - Signature verification (HMAC-SHA256)                     ║
// ║  - Idempotent processing (webhook_logs.event_id)            ║
// ║  - Atomic status updates                                    ║
// ║  - Full audit trail                                         ║
// ╚══════════════════════════════════════════════════════════════╝

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase-client.ts";
import { getPayment, verifyWebhookSignature, MPApiError } from "../_shared/mercadopago.ts";
import type { TxStatus } from "../_shared/types.ts";

// MP status → our status mapping
const STATUS_MAP: Record<string, TxStatus> = {
  approved:     "approved",
  authorized:   "approved",
  pending:      "pending",
  in_process:   "in_process",
  in_mediation: "in_process",
  rejected:     "rejected",
  cancelled:    "cancelled",
  refunded:     "refunded",
  charged_back: "charged_back",
};

// Valid status transitions (prevent regressions)
const VALID_TRANSITIONS: Record<string, TxStatus[]> = {
  pending:      ["approved", "rejected", "cancelled", "in_process"],
  in_process:   ["approved", "rejected", "cancelled"],
  approved:     ["refunded", "charged_back"],
  rejected:     [],
  cancelled:    [],
  refunded:     [],
  charged_back: [],
};

serve(async (req: Request): Promise<Response> => {
  // Always return 200 to prevent MP retries on our errors
  const ack = (body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return ack({ received: false, reason: "method_not_allowed" });
  }

  let rawBody = "";
  let body: Record<string, unknown>;

  try {
    rawBody = await req.text();
    body = JSON.parse(rawBody);
  } catch {
    return ack({ received: false, reason: "invalid_json" });
  }

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  const dataId = String((body.data as Record<string, unknown>)?.id || "");
  const eventType = String(body.action || body.type || "unknown");
  const eventId = body.id ? String(body.id) : xRequestId;

  // ── 1. Verify signature ──
  const signatureValid = await verifyWebhookSignature(xSignature, xRequestId, dataId);

  // ── 2. Log webhook FIRST (audit trail, even if processing fails) ──
  const { data: logEntry, error: logError } = await supabaseAdmin
    .from("webhook_logs")
    .insert({
      provider: "mercadopago",
      event_type: eventType,
      event_id: eventId,
      payload: body,
      headers: {
        "x-signature": xSignature,
        "x-request-id": xRequestId,
        "content-type": req.headers.get("content-type"),
      },
      signature_valid: signatureValid,
      processed: false,
    })
    .select("id")
    .single();

  if (logError) {
    console.error("Failed to log webhook:", logError);
  }

  // ── 3. Reject if signature invalid (but still logged above) ──
  if (!signatureValid && Deno.env.get("WEBHOOK_SECRET")) {
    console.warn(`⚠️ Invalid webhook signature for event ${eventId}`);
    // Still return 200 so MP doesn't keep retrying
    return ack({ received: true, verified: false });
  }

  // ── 4. Idempotency: skip if we already processed this exact event ──
  if (eventId) {
    const { data: existingLog } = await supabaseAdmin
      .from("webhook_logs")
      .select("id, processed")
      .eq("event_id", eventId)
      .eq("processed", true)
      .maybeSingle();

    if (existingLog) {
      console.log(`Skipping duplicate webhook event: ${eventId}`);
      return ack({ received: true, duplicate: true });
    }
  }

  // ── 5. Process payment events ──
  if (eventType.startsWith("payment.") || body.type === "payment") {
    const paymentId = dataId;
    if (!paymentId) {
      return ack({ received: true, reason: "no_payment_id" });
    }

    try {
      // Fetch full payment from Mercado Pago
      const payment = await getPayment(paymentId);
      const newStatus = STATUS_MAP[payment.status] || "pending";
      const externalRef = payment.external_reference;

      if (!externalRef) {
        console.warn(`Payment ${paymentId} has no external_reference`);
        await markLogProcessed(logEntry?.id, null, "No external_reference");
        return ack({ received: true, reason: "no_external_ref" });
      }

      // Fetch current transaction
      const { data: currentTx } = await supabaseAdmin
        .from("transactions")
        .select("id, status")
        .eq("id", externalRef)
        .maybeSingle();

      if (!currentTx) {
        console.warn(`No transaction found for external_reference: ${externalRef}`);
        await markLogProcessed(logEntry?.id, null, "Transaction not found");
        return ack({ received: true, reason: "tx_not_found" });
      }

      // Validate status transition
      const currentStatus = currentTx.status as TxStatus;
      const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];

      if (!allowedTransitions.includes(newStatus)) {
        console.log(`Skipping invalid transition: ${currentStatus} → ${newStatus} for tx ${currentTx.id}`);
        await markLogProcessed(logEntry?.id, currentTx.id, `Invalid transition: ${currentStatus} → ${newStatus}`);
        return ack({ received: true, transition_skipped: true });
      }

      // ── Update transaction ──
      const { error: updateError } = await supabaseAdmin
        .from("transactions")
        .update({
          status: newStatus,
          provider_tx_id: paymentId,
          provider_data: {
            payment_id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail,
            payment_method: payment.payment_method_id,
            date_approved: payment.date_approved,
            payer_email: payment.payer?.email,
            transaction_amount: payment.transaction_amount,
          },
          failure_reason: payment.status === "rejected" ? payment.status_detail : null,
        })
        .eq("id", currentTx.id);

      if (updateError) {
        console.error(`Failed to update transaction ${currentTx.id}:`, updateError);
        await markLogProcessed(logEntry?.id, currentTx.id, updateError.message);
        return ack({ received: true, error: "update_failed" });
      }

      console.log(`✅ Transaction ${currentTx.id}: ${currentStatus} → ${newStatus}`);
      await markLogProcessed(logEntry?.id, currentTx.id, null);

    } catch (mpError) {
      const errMsg = mpError instanceof MPApiError ? mpError.message : (mpError as Error).message;
      console.error(`Failed to process payment ${paymentId}:`, errMsg);
      await markLogProcessed(logEntry?.id, null, errMsg);
    }
  }

  return ack({ received: true });
});

async function markLogProcessed(
  logId: string | undefined,
  transactionId: string | null,
  error: string | null
): Promise<void> {
  if (!logId) return;
  await supabaseAdmin
    .from("webhook_logs")
    .update({
      processed: !error,
      processing_error: error,
      transaction_id: transactionId,
      processed_at: new Date().toISOString(),
    })
    .eq("id", logId);
}
