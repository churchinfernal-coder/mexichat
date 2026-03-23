// ╔══════════════════════════════════════════════════════════════╗
// ║  Mercado Pago API Client                                    ║
// ║  OAuth, Preferences, Payments, Signature Verification       ║
// ║  Timeouts, retries, structured errors                       ║
// ╚══════════════════════════════════════════════════════════════╝

import type {
  MPOAuthTokenResponse,
  MPPreferenceResponse,
  MPPaymentResponse,
} from "./types.ts";

const MP_API = "https://api.mercadopago.com";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

function getEnvOrThrow(key: string): string {
  const val = Deno.env.get(key);
  if (!val) throw new Error(`FATAL: Missing env var ${key}`);
  return val;
}

/**
 * Fetch wrapper with timeout, retries, and structured error handling.
 */
async function mpFetch<T>(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });

    if (!response.ok) {
      const errorBody = await response.text();
      const parsed = tryParseJSON(errorBody);

      // Don't retry 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        throw new MPApiError(
          parsed?.message || `MP API error: ${response.status}`,
          response.status,
          parsed
        );
      }

      // Retry 5xx errors
      if (retries > 0) {
        await delay(1000 * (MAX_RETRIES - retries + 1)); // Exponential backoff
        return mpFetch<T>(url, options, retries - 1);
      }

      throw new MPApiError(
        `MP API error after ${MAX_RETRIES} retries: ${response.status}`,
        response.status,
        parsed
      );
    }

    return await response.json() as T;
  } catch (error) {
    if (error instanceof MPApiError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      if (retries > 0) {
        await delay(1000);
        return mpFetch<T>(url, options, retries - 1);
      }
      throw new MPApiError("Mercado Pago API timeout", 408, null);
    }

    throw new MPApiError(
      `Network error: ${(error as Error).message}`,
      0,
      null
    );
  } finally {
    clearTimeout(timeout);
  }
}

export class MPApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: unknown
  ) {
    super(message);
    this.name = "MPApiError";
  }
}

/**
 * Exchange OAuth authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<MPOAuthTokenResponse> {
  return mpFetch<MPOAuthTokenResponse>(`${MP_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: getEnvOrThrow("MP_CLIENT_ID"),
      client_secret: getEnvOrThrow("MP_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: getEnvOrThrow("MP_REDIRECT_URI"),
    }),
  });
}

/**
 * Refresh an expired access token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<MPOAuthTokenResponse> {
  return mpFetch<MPOAuthTokenResponse>(`${MP_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: getEnvOrThrow("MP_CLIENT_ID"),
      client_secret: getEnvOrThrow("MP_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
}

/**
 * Create a checkout preference for a user-to-user transfer.
 * Money goes to receiver's collector_id via Mercado Pago marketplace model.
 */
export async function createPreference(params: {
  receiverMPUserId: string;
  amount: number;
  description: string;
  senderEmail: string;
  externalReference: string;
}): Promise<MPPreferenceResponse> {
  const backendUrl = getEnvOrThrow("BACKEND_URL");
  const frontendUrl = getEnvOrThrow("FRONTEND_URL");

  return mpFetch<MPPreferenceResponse>(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getEnvOrThrow("MP_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": params.externalReference,
    },
    body: JSON.stringify({
      items: [{
        title: params.description,
        quantity: 1,
        unit_price: params.amount,
        currency_id: "MXN",
      }],
      payer: { email: params.senderEmail },
      back_urls: {
        success: `${frontendUrl}/pagos/result?status=success`,
        failure: `${frontendUrl}/pagos/result?status=failure`,
        pending: `${frontendUrl}/pagos/result?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${backendUrl}/functions/v1/webhook-mercadopago`,
      external_reference: params.externalReference,
      marketplace_fee: 0,
      collector_id: parseInt(params.receiverMPUserId, 10),
      expires: true,
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    }),
  });
}

/**
 * Fetch payment details from Mercado Pago.
 */
export async function getPayment(paymentId: string | number): Promise<MPPaymentResponse> {
  return mpFetch<MPPaymentResponse>(`${MP_API}/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getEnvOrThrow("MP_ACCESS_TOKEN")}`,
    },
  });
}

/**
 * Verify Mercado Pago webhook signature (HMAC-SHA256).
 * Returns true if signature is valid, false otherwise.
 */
export async function verifyWebhookSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string
): Promise<boolean> {
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret || !xSignature) return false;

  try {
    const parts: Record<string, string> = {};
    xSignature.split(",").forEach((part) => {
      const [key, value] = part.trim().split("=");
      if (key && value) parts[key] = value;
    });

    const ts = parts["ts"];
    const hash = parts["v1"];
    if (!ts || !hash) return false;

    const manifest = `id:${dataId};request-id:${xRequestId || ""};ts:${ts};`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
    const expected = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison to prevent timing attacks
    if (expected.length !== hash.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ hash.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

// ─── Helpers ───

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tryParseJSON(str: string): Record<string, unknown> | null {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
