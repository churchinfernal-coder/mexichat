export type TxStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded" | "in_process" | "charged_back";

export interface Transaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  currency: string;
  status: TxStatus;
  description: string | null;
  chat_id: string | null;
  created_at: string;
  updated_at: string;
  provider_data: Record<string, unknown>;
}

export interface SendPaymentResponse {
  transaction_id: string;
  status: string;
  checkout_url: string;
  sandbox_url: string;
  preference_id: string;
  idempotent_replay: boolean;
}

export interface OAuthStatus {
  connected: boolean;
  mp_email: string | null;
  mp_user_id: string | null;
  connected_at: string | null;
}

export interface PaginatedResponse<T> {
  transactions: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface ApiResponse<T> {
  data: T;
  error: null | { message: string; code: string; details?: string; fields?: Array<{ field: string; message: string }> };
  timestamp: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}
