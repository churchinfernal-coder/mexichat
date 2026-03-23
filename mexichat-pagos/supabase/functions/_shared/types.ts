// ╔══════════════════════════════════════════════════════════════╗
// ║  MexiChat Pagos — Shared Type Definitions                   ║
// ╚══════════════════════════════════════════════════════════════╝

export type TxStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded" | "in_process" | "charged_back";
export type TxProvider = "mercadopago" | "oxxo" | "paypal";

export interface Transaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  currency: string;
  status: TxStatus;
  provider: TxProvider;
  provider_tx_id: string | null;
  provider_pref_id: string | null;
  provider_data: Record<string, unknown>;
  description: string | null;
  chat_id: string | null;
  idempotency_key: string;
  ip_address: string | null;
  user_agent: string | null;
  failure_reason: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface MPAuth {
  id: string;
  user_id: string;
  mp_access_token: string;
  mp_refresh_token: string;
  mp_user_id: string;
  mp_email: string | null;
  mp_public_key: string | null;
  token_expires_at: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  provider: TxProvider;
  event_type: string;
  event_id: string | null;
  payload: Record<string, unknown>;
  headers: Record<string, unknown>;
  signature_valid: boolean | null;
  processed: boolean;
  processing_error: string | null;
  transaction_id: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface SendPaymentRequest {
  receiver_id: string;
  amount: number;
  description?: string;
  chat_id?: string;
  idempotency_key: string;
}

export interface MPPreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  collector_id: number;
  external_reference: string;
}

export interface MPOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
  public_key: string;
}

export interface MPPaymentResponse {
  id: number;
  status: string;
  status_detail: string;
  external_reference: string;
  preference_id: string;
  payment_method_id: string;
  date_approved: string | null;
  transaction_amount: number;
  payer: { email: string; id: string };
}

export interface ApiError {
  error: string;
  code: string;
  details?: string;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  count: number;
  total: number;
}
