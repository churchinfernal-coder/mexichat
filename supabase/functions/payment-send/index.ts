import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { handleCors } from '../_shared/cors.ts';
import { ok, err, validationErr } from '../_shared/response.ts';
import { authenticate, adminClient, AuthError } from '../_shared/auth.ts';
import { createPreference, MPError } from '../_shared/mercadopago.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
    if (!body.receiver_id || !UUID_RE.test(String(body.receiver_id)))
      errors.push({ field: 'receiver_id', message: 'UUID válido requerido' });
    if (!body.idempotency_key || !IDEM_RE.test(String(body.idempotency_key)))
      errors.push({ field: 'idempotency_key', message: '16-64 caracteres alfanuméricos' });

    const amt = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount;
    if (typeof amt !== 'number' || !isFinite(amt) || amt <= 0)
      errors.push({ field: 'amount', message: 'Monto positivo requerido' });
    else if (amt > 500000)
      errors.push({ field: 'amount', message: 'Máximo $500,000 MXN' });

    if (body.chat_id && !UUID_RE.test(String(body.chat_id)))
      errors.push({ field: 'chat_id', message: 'UUID válido requerido' });
    if (errors.length) return validationErr(req, errors);

    const amount = Math.round((amt as number) * 100) / 100;
    const receiverId = String(body.receiver_id);
    const idempotencyKey = String(body.idempotency_key);
    const description = body.description
      ? String(body.description).trim().replace(/<[^>]*>/g, '').substring(0, 280)
      : 'Pago via MexiChat';
    const chatId = body.chat_id ? String(body.chat_id) : null;

    if (user.id === receiverId)
      return err(req, 'No puedes enviarte dinero a ti mismo', 'SELF_TRANSFER');

    // Rate limit (DB function)
    const { data: rl } = await adminClient.rpc('fn_check_rate_limit', { p_user_id: user.id, p_amount: amount });
    if (rl && !(rl as { allowed: boolean }).allowed)
      return err(req, (rl as { reason: string }).reason || 'Límite excedido', 'RATE_LIMITED', 429);

    // Idempotency
    const { data: existing } = await adminClient
      .from('transactions').select('id, status, provider_data')
      .eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) {
      const pd = (existing.provider_data || {}) as Record<string, unknown>;
      return ok(req, {
        transaction_id: existing.id, status: existing.status,
        checkout_url: pd.init_point || null, sandbox_url: pd.sandbox_init_point || null,
        idempotent_replay: true,
      });
    }

    // Verify both users have MP connected
    const { data: receiverAuth } = await adminClient
      .from('mp_auth').select('mp_user_id')
      .eq('user_id', receiverId).eq('is_active', true).maybeSingle();
    if (!receiverAuth) return err(req, 'Destinatario no tiene Mercado Pago vinculado', 'RECEIVER_NOT_CONNECTED');

    const { data: senderAuth } = await adminClient
      .from('mp_auth').select('mp_user_id')
      .eq('user_id', user.id).eq('is_active', true).maybeSingle();
    if (!senderAuth) return err(req, 'Vincula tu cuenta de Mercado Pago primero', 'SENDER_NOT_CONNECTED');

    // Insert transaction (user-scoped client respects RLS insert policy)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${user.jwt}` } },
        auth: { autoRefreshToken: false, persistSession: false } }
    );

    const clientIp = req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
      || req.headers.get('CF-Connecting-IP') || null;

    const { data: tx, error: txErr } = await userClient
      .from('transactions')
      .insert({
        sender_id: user.id, receiver_id: receiverId, amount, currency: 'MXN',
        status: 'pending', provider: 'mercadopago', description, chat_id: chatId,
        idempotency_key: idempotencyKey, ip_address: clientIp,
        user_agent: req.headers.get('User-Agent')?.substring(0, 512) || null,
      })
      .select('id').single();

    if (txErr) {
      if (txErr.code === '23505') return err(req, 'Transacción duplicada', 'DUPLICATE', 409);
      return err(req, 'Error creando transacción', 'TX_INSERT_FAILED', 500, txErr.message);
    }

    // Create MP preference
    let pref;
    try {
      pref = await createPreference({
        receiverMPUserId: receiverAuth.mp_user_id, amount, description,
        senderEmail: user.email, externalReference: tx!.id,
      });
    } catch (e) {
      await adminClient.from('transactions').update({
        status: 'rejected',
        failure_reason: e instanceof MPError ? `MP ${e.status}: ${e.message}` : (e as Error).message,
      }).eq('id', tx!.id);
      return err(req, 'Error con Mercado Pago. Intenta de nuevo.', 'MP_ERROR', 502);
    }

    // Update with MP ref
    await adminClient.from('transactions').update({
      provider_pref_id: pref.id,
      provider_data: { preference_id: pref.id, init_point: pref.init_point, sandbox_init_point: pref.sandbox_init_point },
    }).eq('id', tx!.id);

    return ok(req, {
      transaction_id: tx!.id, status: 'pending',
      checkout_url: pref.init_point, sandbox_url: pref.sandbox_init_point,
      preference_id: pref.id, idempotent_replay: false,
    }, 201);

  } catch (e) {
    if (e instanceof AuthError) return err(req, e.message, 'AUTH_FAILED', 401);
    console.error('payment-send error:', e);
    return err(req, 'Error interno', 'INTERNAL', 500);
  }
});
