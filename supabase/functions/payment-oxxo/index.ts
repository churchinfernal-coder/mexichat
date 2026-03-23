import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { handleCors } from '../_shared/cors.ts';
import { ok, err, validationErr } from '../_shared/response.ts';
import { authenticate, adminClient, AuthError } from '../_shared/auth.ts';
import { MPError } from '../_shared/mercadopago.ts';

const MP_API = 'https://api.mercadopago.com';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEM_RE = /^[a-zA-Z0-9_-]{16,64}$/;

function env(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return err(req, 'Method not allowed', 'METHOD_NOT_ALLOWED', 405);

  try {
    const user = await authenticate(req);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return err(req, 'JSON invalido', 'INVALID_JSON'); }

    // Validate
    const errors: Array<{ field: string; message: string }> = [];
    if (!body.receiver_id || !UUID_RE.test(String(body.receiver_id)))
      errors.push({ field: 'receiver_id', message: 'UUID valido requerido' });
    if (!body.idempotency_key || !IDEM_RE.test(String(body.idempotency_key)))
      errors.push({ field: 'idempotency_key', message: '16-64 caracteres alfanumericos' });
    if (!body.payer_email || !String(body.payer_email).includes('@'))
      errors.push({ field: 'payer_email', message: 'Email requerido para OXXO' });

    const amt = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount;
    if (typeof amt !== 'number' || !isFinite(amt) || amt < 10)
      errors.push({ field: 'amount', message: 'Monto minimo $10 MXN para OXXO' });
    else if (amt > 10000)
      errors.push({ field: 'amount', message: 'Maximo $10,000 MXN para OXXO' });

    if (errors.length) return validationErr(req, errors);

    const amount = Math.round((amt as number) * 100) / 100;
    const receiverId = String(body.receiver_id);
    const idempotencyKey = String(body.idempotency_key);
    const payerEmail = String(body.payer_email);
    const description = body.description
      ? String(body.description).trim().replace(/<[^>]*>/g, '').substring(0, 280)
      : 'Pago via MexiChat (OXXO)';

    if (user.id === receiverId)
      return err(req, 'No puedes enviarte dinero a ti mismo', 'SELF_TRANSFER');

    // Rate limit
    const { data: rl } = await adminClient.rpc('fn_check_rate_limit', { p_user_id: user.id, p_amount: amount });
    if (rl && !(rl as { allowed: boolean }).allowed)
      return err(req, (rl as { reason: string }).reason || 'Limite excedido', 'RATE_LIMITED', 429);

    // Idempotency check
    const { data: existing } = await adminClient
      .from('transactions').select('id, status, provider_data')
      .eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) {
      const pd = (existing.provider_data || {}) as Record<string, unknown>;
      return ok(req, {
        transaction_id: existing.id, status: existing.status,
        ticket_url: pd.ticket_url || null,
        barcode: pd.barcode || null,
        expiration_date: pd.expiration_date || null,
        idempotent_replay: true,
      });
    }

    // Insert transaction
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
        status: 'pending', provider: 'oxxo', description,
        idempotency_key: idempotencyKey, ip_address: clientIp,
        user_agent: req.headers.get('User-Agent')?.substring(0, 512) || null,
      })
      .select('id').single();

    if (txErr) {
      if (txErr.code === '23505') return err(req, 'Transaccion duplicada', 'DUPLICATE', 409);
      return err(req, 'Error creando transaccion', 'TX_INSERT_FAILED', 500, txErr.message);
    }

    // Create OXXO payment via Mercado Pago /v1/payments
    let mpPayment;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(`${MP_API}/v1/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env('MP_ACCESS_TOKEN')}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: amount,
          description,
          payment_method_id: 'oxxo',
          payer: {
            email: payerEmail,
            first_name: user.identifier,
          },
          metadata: {
            transaction_id: tx!.id,
            sender_id: user.id,
            receiver_id: receiverId,
          },
          notification_url: `${env('SUPABASE_URL')}/functions/v1/webhook-mercadopago`,
          external_reference: tx!.id,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errBody = await res.text();
        throw new MPError(`MP API ${res.status}: ${errBody}`, res.status);
      }
      mpPayment = await res.json();
    } catch (e) {
      await adminClient.from('transactions').update({
        status: 'rejected',
        failure_reason: e instanceof MPError ? `MP ${e.status}: ${e.message}` : (e as Error).message,
      }).eq('id', tx!.id);
      return err(req, 'Error creando pago OXXO. Intenta de nuevo.', 'MP_OXXO_ERROR', 502);
    }

    // Extract OXXO ticket info
    const ticketUrl = mpPayment.transaction_details?.external_resource_url || '';
    const barcode = mpPayment.barcode?.content || mpPayment.transaction_details?.barcode?.content || '';
    const expirationDate = mpPayment.date_of_expiration || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // Update transaction with OXXO data
    await adminClient.from('transactions').update({
      provider_tx_id: String(mpPayment.id),
      provider_data: {
        payment_id: mpPayment.id,
        ticket_url: ticketUrl,
        barcode: barcode,
        expiration_date: expirationDate,
        status: mpPayment.status,
        status_detail: mpPayment.status_detail,
      },
    }).eq('id', tx!.id);

    return ok(req, {
      transaction_id: tx!.id,
      status: 'pending',
      ticket_url: ticketUrl,
      barcode: barcode,
      expiration_date: expirationDate,
      idempotent_replay: false,
    }, 201);

  } catch (e) {
    if (e instanceof AuthError) return err(req, e.message, 'AUTH_FAILED', 401);
    console.error('payment-oxxo error:', e);
    return err(req, 'Error interno', 'INTERNAL', 500);
  }
});