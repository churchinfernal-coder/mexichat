// ╔══════════════════════════════════════════════════════════════╗
// ║  POST /functions/v1/payment-send                            ║
// ║  Creates a transaction + Mercado Pago checkout preference   ║
// ║  Rate-limited, idempotent, fraud-checked                    ║
// ╚══════════════════════════════════════════════════════════════╝

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { jsonResponse, errorResponse, validationErrorResponse } from "../_shared/response.ts";
import { validateSendPayment } from "../_shared/validation.ts";
import { supabaseAdmin, supabaseForUser } from "../_shared/supabase-client.ts";
import { createPreference, MPApiError } from "../_shared/mercadopago.ts";
import type { RateLimitResult, Transaction } from "../_shared/types.ts";

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Method check
  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }

  try {
    // ── 1. Authenticate ──
    const user = await authenticateRequest(req);
    if (user instanceof Response) return user; // Auth error

    // ── 2. Parse & Validate ──
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse(req, "Invalid JSON body", "INVALID_JSON", 400);
    }

    const validation = validateSendPayment(body);
    if (!validation.valid) {
      return validationErrorResponse(req, validation.errors);
    }
    const input = validation.data!;

    // ── 3. Self-transfer check ──
    if (user.id === input.receiver_id) {
      return errorResponse(req, "Cannot send money to yourself", "SELF_TRANSFER", 400);
    }

    // ── 4. Rate limit check (server-side, via DB function) ──
    const { data: rateResult, error: rateError } = await supabaseAdmin
      .rpc("fn_check_rate_limit", { p_user_id: user.id, p_amount: input.amount });

    if (rateError) {
      console.error("Rate limit check failed:", rateError);
      return errorResponse(req, "Service temporarily unavailable", "RATE_LIMIT_ERROR", 503);
    }

    const rateLimitResult = rateResult as unknown as RateLimitResult;
    if (!rateLimitResult.allowed) {
      return errorResponse(
        req,
        rateLimitResult.reason || "Rate limit exceeded",
        "RATE_LIMITED",
        429
      );
    }

    // ── 5. Idempotency check ──
    const { data: existing } = await supabaseAdmin
      .from("transactions")
      .select("id, status, provider_pref_id, provider_data")
      .eq("idempotency_key", input.idempotency_key)
      .maybeSingle();

    if (existing) {
      // Return the existing transaction (idempotent replay)
      return jsonResponse(req, {
        transaction_id: existing.id,
        status: existing.status,
        checkout_url: (existing.provider_data as Record<string, unknown>)?.init_point || null,
        sandbox_url: (existing.provider_data as Record<string, unknown>)?.sandbox_init_point || null,
        idempotent_replay: true,
      });
    }

    // ── 6. Verify receiver exists and has MP connected ──
    const { data: receiverAuth, error: receiverError } = await supabaseAdmin
      .from("mp_auth")
      .select("mp_user_id, mp_email")
      .eq("user_id", input.receiver_id)
      .eq("is_active", true)
      .maybeSingle();

    if (receiverError || !receiverAuth) {
      return errorResponse(
        req,
        "Recipient does not have Mercado Pago connected",
        "RECEIVER_NOT_CONNECTED",
        400
      );
    }

    // ── 7. Verify sender has MP connected ──
    const { data: senderAuth } = await supabaseAdmin
      .from("mp_auth")
      .select("mp_user_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!senderAuth) {
      return errorResponse(
        req,
        "You must connect your Mercado Pago account first",
        "SENDER_NOT_CONNECTED",
        400
      );
    }

    // ── 8. Create transaction record (pending) ──
    const clientIp = req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
      || req.headers.get("CF-Connecting-IP")
      || null;

    const userSupabase = supabaseForUser(user.jwt);
    const { data: transaction, error: txError } = await userSupabase
      .from("transactions")
      .insert({
        sender_id: user.id,
        receiver_id: input.receiver_id,
        amount: input.amount,
        currency: "MXN",
        status: "pending",
        provider: "mercadopago",
        description: input.description || "Pago via MexiChat",
        chat_id: input.chat_id,
        idempotency_key: input.idempotency_key,
        ip_address: clientIp,
        user_agent: req.headers.get("User-Agent")?.substring(0, 512) || null,
      })
      .select()
      .single();

    if (txError || !transaction) {
      console.error("Transaction insert failed:", txError);

      // Check for idempotency key conflict (race condition)
      if (txError?.code === "23505") {
        return errorResponse(req, "Duplicate transaction", "DUPLICATE", 409);
      }

      return errorResponse(
        req,
        "Failed to create transaction",
        "TX_INSERT_FAILED",
        500,
        txError?.message
      );
    }

    // ── 9. Create Mercado Pago checkout preference ──
    let preference;
    try {
      preference = await createPreference({
        receiverMPUserId: receiverAuth.mp_user_id,
        amount: input.amount,
        description: input.description || "Pago via MexiChat",
        senderEmail: user.email,
        externalReference: transaction.id,
      });
    } catch (mpError) {
      // Mark transaction as failed
      await supabaseAdmin
        .from("transactions")
        .update({
          status: "rejected",
          failure_reason: mpError instanceof MPApiError
            ? `MP API ${mpError.statusCode}: ${mpError.message}`
            : (mpError as Error).message,
        })
        .eq("id", transaction.id);

      console.error("MP preference creation failed:", mpError);
      return errorResponse(
        req,
        "Payment provider error. Please try again.",
        "MP_PREFERENCE_FAILED",
        502
      );
    }

    // ── 10. Update transaction with MP reference ──
    await supabaseAdmin
      .from("transactions")
      .update({
        provider_pref_id: preference.id,
        provider_data: {
          preference_id: preference.id,
          init_point: preference.init_point,
          sandbox_init_point: preference.sandbox_init_point,
          collector_id: preference.collector_id,
        },
      })
      .eq("id", transaction.id);

    // ── 11. Return checkout URL ──
    return jsonResponse(req, {
      transaction_id: transaction.id,
      status: "pending",
      checkout_url: preference.init_point,
      sandbox_url: preference.sandbox_init_point,
      preference_id: preference.id,
      idempotent_replay: false,
    }, 201);

  } catch (error) {
    // If authenticateRequest threw a Response, return it
    if (error instanceof Response) return error;

    console.error("Unhandled error in payment-send:", error);
    return errorResponse(req, "Internal server error", "INTERNAL_ERROR", 500);
  }
});
