import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err, validationErr } from '../_shared/response.ts';
import { authenticate, adminClient, AuthError } from '../_shared/auth.ts';
import { createFacilitatorPreference, MPError } from '../_shared/mercadopago.ts';

const IDEM_RE = /^[a-zA-Z0-9_-]{16,64}$/;

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return err(req, 'Method not allowed', 'METHOD_NOT_ALLOWED', 405);

  try {
    const user = await authenticate(req);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return err(req, 'JSON inválido', 'INVALID_JSON'); }

    // Validate
    const errors: Array<{ field: string; message: string }> = [];
    if (!body.idempotency_key || !IDEM_RE.test(String(body.idempotency_key)))
      errors.push({ field: 'idempotency_key', message: '16-64 caracteres alfanuméricos' });

    const amt = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount;
    if (typeof amt !== 'number' || !isFinite(amt) || amt < 10)
      errors.push({ field: 'amount', message: 'Monto mínimo $10 MXN' });
    else if (amt > 500000)
      errors.push({ field: 'amount', message: 'Máximo $500,000 MXN' });

    if (errors.length) return validationErr(req, errors);

    const amount = Math.round((amt as number) * 100) / 100;
    const idempotencyKey = String(body.idempotency_key);
    const description = body.description
      ? String(body.description).trim().replace(/<[^>]*>/g, '').substring(0, 280)
      : 'Pago via MexiChat';
    const provider = body.provider === 'oxxo' ? 'oxxo' : 'mercadopago';

    // Rate limit
    const { data: rl } = await adminClient.rpc('fn_check_rate_limit', { p_user_id: user.id, p_amount: amount });
    if (rl && !(rl as { allowed: boolean }).allowed)
      return err(req, (rl as { reason: string }).reason || 'Límite excedido', 'RATE_LIMITED', 429);

    // Idempotency check
    const { data: existing } = await adminClient
      .from('transactions').select('id, status, provider_data')
      .eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) {
      const pd = (existing.provider_data || {}) as Record<string, unknown>;
      return ok(req, {
        transaction_id: existing.id,
        status: existing.status,
        checkout_url: pd.init_point || null,
        sandbox_url: pd.sandbox_init_point || null,
        idempotent_replay: true,
      });
    }

    // Get client IP
    const clientIp = req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
      || req.headers.get('CF-Connecting-IP') || null;

    // Insert transaction — sender is user, receiver is MexiChat (same as sender for facilitator)
    const { data: tx, error: txErr } = await adminClient
      .from('transactions')
      .insert({
        sender_id: user.id,
        receiver_id: user.id, // Facilitator: MexiChat receives, we track by sender
        amount,
        currency: 'MXN',
        status: 'pending',
        provider,
        description,
        idempotency_key: idempotencyKey,
        ip_address: clientIp,
        user_agent: req.headers.get('User-Agent')?.substring(0, 512) || null,
      })
      .select('id')
      .single();

    if (txErr) {
      if (txErr.code === '23505') return err(req, 'Transacción duplicada', 'DUPLICATE', 409);
      console.error('TX insert error:', txErr);
      return err(req, 'Error creando transacción', 'TX_INSERT_FAILED', 500);
    }

    // Create MP preference (all payments go to MexiChat's account)
    let pref;
    try {
      pref = await createFacilitatorPreference({
        amount,
        description,
        payerEmail: user.email,
        externalReference: tx!.id,
      });
    } catch (e) {
      await adminClient.from('transactions').update({
        status: 'rejected',
        failure_reason: e instanceof MPError ? `MP ${e.status}: ${e.message}` : (e as Error).message,
      }).eq('id', tx!.id);
      console.error('MP error:', e);
      return err(req, 'Error con Mercado Pago. Intenta de nuevo.', 'MP_ERROR', 502);
    }

    // Update transaction with MP reference
    await adminClient.from('transactions').update({
      provider_pref_id: pref.id,
      provider_data: {
        preference_id: pref.id,
        init_point: pref.init_point,
        sandbox_init_point: pref.sandbox_init_point,
      },
    }).eq('id', tx!.id);

    return ok(req, {
      transaction_id: tx!.id,
      status: 'pending',
      checkout_url: pref.init_point,
      sandbox_url: pref.sandbox_init_point,
      preference_id: pref.id,
      idempotent_replay: false,
    }, 201);

  } catch (e) {
    if (e instanceof AuthError) return err(req, e.message, 'AUTH_FAILED', 401);
    console.error('payment-send error:', e);
    return err(req, 'Error interno', 'INTERNAL', 500);
  }
});