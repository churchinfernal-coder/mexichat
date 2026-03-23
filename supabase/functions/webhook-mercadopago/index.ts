import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { adminClient } from '../_shared/auth.ts';
import { getPayment, verifySignature } from '../_shared/mercadopago.ts';

type TxStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'in_process' | 'charged_back';

const STATUS_MAP: Record<string, TxStatus> = {
  approved: 'approved', authorized: 'approved', pending: 'pending',
  in_process: 'in_process', in_mediation: 'in_process', rejected: 'rejected',
  cancelled: 'cancelled', refunded: 'refunded', charged_back: 'charged_back',
};

const TRANSITIONS: Record<string, TxStatus[]> = {
  pending: ['approved', 'rejected', 'cancelled', 'in_process'],
  in_process: ['approved', 'rejected', 'cancelled'],
  approved: ['refunded', 'charged_back'],
  rejected: [], cancelled: [], refunded: [], charged_back: [],
};

const ack = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

serve(async (req: Request) => {
  if (req.method !== 'POST') return ack({ received: false });

  let body: Record<string, unknown>;
  try { body = JSON.parse(await req.text()); } catch { return ack({ received: false, reason: 'invalid_json' }); }

  const xSig = req.headers.get('x-signature');
  const xReq = req.headers.get('x-request-id');
  const dataId = String((body.data as Record<string, unknown>)?.id || '');
  const eventType = String(body.action || body.type || 'unknown');
  const eventId = body.id ? String(body.id) : xReq;

  const sigValid = await verifySignature(xSig, xReq, dataId);

  // Always log
  const { data: log } = await adminClient.from('webhook_logs').insert({
    provider: 'mercadopago', event_type: eventType, event_id: eventId,
    payload: body, headers: { 'x-signature': xSig, 'x-request-id': xReq },
    signature_valid: sigValid, processed: false,
  }).select('id').single();

  if (!sigValid && Deno.env.get('WEBHOOK_SECRET')) {
    return ack({ received: true, verified: false });
  }

  // Dedupe
  if (eventId) {
    const { data: dup } = await adminClient.from('webhook_logs')
      .select('id').eq('event_id', eventId).eq('processed', true).maybeSingle();
    if (dup) return ack({ received: true, duplicate: true });
  }

  // Process payment events
  if (eventType.startsWith('payment.') || body.type === 'payment') {
    if (!dataId) return ack({ received: true, reason: 'no_payment_id' });

    try {
      const payment = await getPayment(dataId);
      const newStatus = STATUS_MAP[payment.status] || 'pending';
      const extRef = payment.external_reference;
      if (!extRef) {
        await markLog(log?.id, null, 'No external_reference');
        return ack({ received: true });
      }

      const { data: tx } = await adminClient.from('transactions')
        .select('id, status').eq('id', extRef).maybeSingle();
      if (!tx) {
        await markLog(log?.id, null, 'Transaction not found');
        return ack({ received: true });
      }

      const allowed = TRANSITIONS[tx.status as string] || [];
      if (!allowed.includes(newStatus)) {
        await markLog(log?.id, tx.id, `Invalid: ${tx.status} → ${newStatus}`);
        return ack({ received: true, transition_skipped: true });
      }

      await adminClient.from('transactions').update({
        status: newStatus, provider_tx_id: String(payment.id),
        provider_data: {
          payment_id: payment.id, status: payment.status, status_detail: payment.status_detail,
          payment_method: payment.payment_method_id, date_approved: payment.date_approved,
          payer_email: payment.payer?.email, transaction_amount: payment.transaction_amount,
        },
        failure_reason: payment.status === 'rejected' ? payment.status_detail : null,
      }).eq('id', tx.id);

      await markLog(log?.id, tx.id, null);
      console.log(`✅ ${tx.id}: ${tx.status} → ${newStatus}`);
    } catch (e) {
      await markLog(log?.id, null, (e as Error).message);
    }
  }

  return ack({ received: true });
});

async function markLog(id: string | undefined, txId: string | null, error: string | null) {
  if (!id) return;
  await adminClient.from('webhook_logs').update({
    processed: !error, processing_error: error, transaction_id: txId,
    processed_at: new Date().toISOString(),
  }).eq('id', id);
}
