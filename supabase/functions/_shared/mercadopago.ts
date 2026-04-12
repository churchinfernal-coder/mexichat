const MP_API = 'https://api.mercadopago.com';
const TIMEOUT_MS = 10_000;

// MexiChat's collector ID (from your MP_ACCESS_TOKEN)
const MEXICHAT_COLLECTOR_ID = 3258944496;
const MEXICHAT_FEE_MXN = 5;

function env(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
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

/**
 * FACILITATOR MODEL: All payments go to MexiChat's account
 * No OAuth required for users
 */
export async function createFacilitatorPreference(params: {
  amount: number;
  description: string;
  payerEmail: string | null;
  externalReference: string;
}) {
  const payerEmail = params.payerEmail || `user-${params.externalReference.substring(0, 8)}@mexichat.mx`;
  const frontendUrl = env('FRONTEND_URL');

  return mpFetch<{
    id: string;
    init_point: string;
    sandbox_init_point: string;
  }>(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env('MP_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': params.externalReference,
    },
    body: JSON.stringify({
      items: [{
        title: params.description,
        quantity: 1,
        unit_price: params.amount + MEXICHAT_FEE_MXN, // Amount + $5 fee
        currency_id: 'MXN',
      }],
      payer: { email: payerEmail },
      back_urls: {
        success: `${frontendUrl}/pagos/result?status=success`,
        failure: `${frontendUrl}/pagos/result?status=failure`,
        pending: `${frontendUrl}/pagos/result?status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${env('SUPABASE_URL')}/functions/v1/webhook-mercadopago`,
      external_reference: params.externalReference,
      // NO collector_id = payment goes to MexiChat's account (owner of MP_ACCESS_TOKEN)
      // NO marketplace_fee = we're not splitting, we receive full amount
      expires: true,
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }),
  });
}

// Keep your existing functions below (exchangeOAuthCode, refreshToken, getPayment, verifySignature)
// ...