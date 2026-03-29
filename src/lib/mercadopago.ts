/**
 * MexiChat â€” Mercado Pago client library (production)
 * Supports: Mercado Pago Checkout + OXXO cash payments
 */

import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ----------

export type TxProvider = 'mercadopago' | 'oxxo';
export type TxStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'in_process' | 'charged_back';

export class MexiPayError extends Error {
  constructor(message: string, public code: string, public details?: string) {
    super(message);
    this.name = 'MexiPayError';
  }
}

// ----------

async function callEdgeFunction<T>(name: string, opts: {
  method?: string;
  body?: Record<string, unknown>;
}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new MexiPayError('No autenticado', 'AUTH_REQUIRED');
  }

  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: opts.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const json = await res.json();

  if (!res.ok) {
    const errMsg = json?.error?.message || json?.error || 'Error del servidor';
    const errCode = json?.error?.code || 'SERVER_ERROR';
    throw new MexiPayError(errMsg, errCode, json?.error?.details);
  }

  return (json.data ?? json) as T;
}

// ----------

export interface PaymentResult {
  transaction_id: string;
  status: string;
  checkout_url: string;
  sandbox_url: string;
  preference_id: string;
  idempotent_replay: boolean;
}

export interface OXXOResult {
  transaction_id: string;
  status: string;
  ticket_url: string;
  barcode: string;
  expiration_date: string;
}

// ----------

/**
 * Create a payment via Mercado Pago checkout.
 * Returns checkout URLs to redirect the user to.
 */
export async function createPayment(params: {
  receiver_id: string;
  amount: number;
  description?: string;
  chat_id?: string;
  idempotency_key: string;
}): Promise<PaymentResult> {
  return callEdgeFunction<PaymentResult>('payment-send', {
    method: 'POST',
    body: params,
  });
}

// ----------

/**
 * Create an OXXO cash payment reference via Mercado Pago.
 * Returns a ticket URL and barcode for the user to pay at OXXO.
 */
export async function createOXXOPayment(params: {
  receiver_id: string;
  amount: number;
  description?: string;
  payer_email: string;
  idempotency_key: string;
}): Promise<OXXOResult> {
  return callEdgeFunction<OXXOResult>('payment-oxxo', {
    method: 'POST',
    body: params,
  });
}

// ----------

export interface ContactResult {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  phone: string | null;
}

/**
 * Search contacts by name, username, or phone number.
 */
export async function searchContacts(query: string): Promise<ContactResult[]> {
  if (!query || query.trim().length < 2) return [];

  const q = query.trim().toLowerCase();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, phone')
    .or(`full_name.ilike.%${q}%,username.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(10);

  if (error) {
    console.error('[searchContacts]', error.message);
    return [];
  }

  return (data ?? []) as ContactResult[];
}