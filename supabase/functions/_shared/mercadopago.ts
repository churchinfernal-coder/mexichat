const MP_API = 'https://api.mercadopago.com';
const TIMEOUT_MS = 10_000;

function env(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function optEnv(key: string): string | undefined {
  return Deno.env.get(key);
}

async function mpFetch<T>(url: string, init: RequestInit, retries = 2): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text();
      if (res.status >= 500 && retries > 0) {
        await new Promise(r => setTimeout(r, 1000 * (3 - retries)));
        return mpFetch<T>(url, init, retries - 1);
      }
      throw new MPError(`MP API ${res.status}: ${body}`, res.status);
    }
    return await res.json() as T;
  } catch (e) {
    if (e instanceof MPError) throw e;
    if ((e as Error).name === 'AbortError') {
      if (retries > 0) return mpFetch<T>(url, init, retries - 1);
      throw new MPError('Mercado Pago timeout', 408);
    }
    throw new MPError((e as Error).message, 0);
  } finally {
    clearTimeout(timer);
  }
}

export class MPError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'MPError';
  }
}

export async function exchangeOAuthCode(code: string) {
  const redirectUri = optEnv('MP_REDIRECT_URI') || `${env('FRONTEND_URL')}/pagos/oauth-callback`;
  return mpFetch<{
    access_token: string; refresh_token: string; expires_in: number;
    user_id: number; public_key: string; scope: string;
  }>(`${MP_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env('MP_CLIENT_ID'),
      client_secret: env('MP_CLIENT_SECRET'),
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
}

export async function refreshToken(rt: string) {
  return mpFetch<{
    access_token: string; refresh_token: string; expires_in: number;
  }>(`${MP_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env('MP_CLIENT_ID'),
      client_secret: env('MP_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: rt,
    }),
  });
}

export async function createPreference(params: {
  receiverMPUserId: string; amount: number; description: string;
  senderEmail: string | null; externalReference: string;
}) {
  // MP requires payer.email — use placeholder for phone-only users
  const payerEmail = params.senderEmail || `user-${params.externalReference.substring(0, 8)}@mexichat.mx`;

  return mpFetch<{
    id: string; init_point: string; sandbox_init_point: string; collector_id: number;
  }>(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env('MP_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': params.externalReference,
    },
    body: JSON.stringify({
      items: [{ title: params.description, quantity: 1, unit_price: params.amount, currency_id: 'MXN' }],
      payer: { email: payerEmail },
      back_urls: {
        success: `${env('FRONTEND_URL')}/pagos/result?status=success`,
        failure: `${env('FRONTEND_URL')}/pagos/result?status=failure`,
        pending: `${env('FRONTEND_URL')}/pagos/result?status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${env('SUPABASE_URL')}/functions/v1/webhook-mercadopago`,
      external_reference: params.externalReference,
      marketplace_fee: 5,
      collector_id: parseInt(params.receiverMPUserId, 10),
      expires: true,
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }),
  });
}

export async function getPayment(paymentId: string | number) {
  return mpFetch<{
    id: number; status: string; status_detail: string; external_reference: string;
    preference_id: string; payment_method_id: string; date_approved: string | null;
    transaction_amount: number; payer: { email: string };
  }>(`${MP_API}/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${env('MP_ACCESS_TOKEN')}` },
  });
}

export async function verifySignature(
  xSig: string | null, xReqId: string | null, dataId: string
): Promise<boolean> {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || !xSig) return false;
  try {
    const parts: Record<string, string> = {};
    xSig.split(',').forEach(p => { const [k, v] = p.trim().split('='); if (k && v) parts[k] = v; });
    const { ts, v1: hash } = parts;
    if (!ts || !hash) return false;
    const manifest = `id:${dataId};request-id:${xReqId || ''};ts:${ts};`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(manifest));
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (expected.length !== hash.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ hash.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}