// ╔══════════════════════════════════════════════════════════════╗
// ║  MexiChat Pagos — Frontend API Client                       ║
// ║  Type-safe, error-handled, retry-capable                    ║
// ╚══════════════════════════════════════════════════════════════╝

import { createClient } from "@supabase/supabase-js";
import type {
  ApiResponse,
  SendPaymentResponse,
  OAuthStatus,
  PaginatedResponse,
  Transaction,
} from "../types/pagos";

// ─── Supabase Client ───
const SUPABASE_URL = "https://cchakgecusfybcokbmau.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjaGFrZ2VjdXNmeWJjb2tibWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzOTA3NDksImV4cCI6MjA4Mzk2Njc0OX0.TWy1NmGHFDzBSJi3-z1k4f8_bkoxP94NPBUqOrGyGb8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

// ─── Core fetch wrapper ───
async function callFunction<T>(
  name: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    params?: Record<string, string>;
  } = {}
): Promise<T> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) {
    throw new PagosError("Not authenticated. Please log in.", "NOT_AUTHENTICATED");
  }

  const { method = "GET", body, params } = options;

  let url = `${FUNCTIONS_BASE}/${name}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json: ApiResponse<T> = await response.json();

  if (json.error) {
    throw new PagosError(
      json.error.message,
      json.error.code,
      json.error.details,
      json.error.fields
    );
  }

  return json.data;
}

// ─── Error class ───
export class PagosError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: string,
    public fields?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = "PagosError";
  }
}

// ─── API Methods ───

export function generateIdempotencyKey(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, "").substring(0, 16);
  return `mc-${timestamp}-${random}`;
}

export async function sendPayment(params: {
  receiver_id: string;
  amount: number;
  description?: string;
  chat_id?: string;
  idempotency_key?: string;
}): Promise<SendPaymentResponse> {
  return callFunction<SendPaymentResponse>("payment-send", {
    method: "POST",
    body: {
      ...params,
      idempotency_key: params.idempotency_key || generateIdempotencyKey(),
    },
  });
}

export async function getPaymentHistory(
  page: number = 1,
  limit: number = 20,
  status?: string
): Promise<PaginatedResponse<Transaction>> {
  const params: Record<string, string> = {
    page: page.toString(),
    limit: limit.toString(),
  };
  if (status) params.status = status;

  return callFunction<PaginatedResponse<Transaction>>("payment-history", { params });
}

export async function getPaymentStatus(transactionId: string): Promise<Transaction> {
  return callFunction<Transaction>("payment-status", {
    params: { id: transactionId },
  });
}

export async function getOAuthStatus(): Promise<OAuthStatus> {
  return callFunction<OAuthStatus>("oauth-status");
}

export async function getOAuthConnectUrl(): Promise<{ auth_url: string }> {
  return callFunction<{ auth_url: string }>("oauth-connect");
}
