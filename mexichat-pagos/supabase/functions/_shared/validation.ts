// ╔══════════════════════════════════════════════════════════════╗
// ║  Input Validation & Sanitization                            ║
// ║  Enterprise-grade: XSS prevention, type coercion, limits   ║
// ╚══════════════════════════════════════════════════════════════╝

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_REGEX = /^[a-zA-Z0-9_-]{16,64}$/;

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates a UUID string.
 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/**
 * Validates an idempotency key (16-64 alphanumeric chars + dash/underscore).
 */
export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && IDEMPOTENCY_REGEX.test(value);
}

/**
 * Sanitizes a string: trims, removes null bytes, limits length.
 */
export function sanitizeString(value: unknown, maxLength: number = 280): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  return value
    .trim()
    .replace(/\0/g, "")        // Remove null bytes
    .replace(/<[^>]*>/g, "")   // Strip HTML tags (XSS)
    .substring(0, maxLength);
}

/**
 * Validates payment amount: must be positive, max $500,000 MXN, max 2 decimals.
 */
export function validateAmount(value: unknown): { valid: boolean; amount: number; error?: string } {
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (typeof num !== "number" || isNaN(num)) {
    return { valid: false, amount: 0, error: "Amount must be a number" };
  }
  if (!isFinite(num)) {
    return { valid: false, amount: 0, error: "Amount must be finite" };
  }
  if (num <= 0) {
    return { valid: false, amount: 0, error: "Amount must be greater than 0" };
  }
  if (num > 500000) {
    return { valid: false, amount: 0, error: "Amount cannot exceed $500,000 MXN" };
  }

  // Round to 2 decimal places to prevent floating point attacks
  const rounded = Math.round(num * 100) / 100;
  if (rounded <= 0) {
    return { valid: false, amount: 0, error: "Amount rounds to zero" };
  }

  return { valid: true, amount: rounded };
}

/**
 * Validates the full SendPayment request body.
 */
export function validateSendPayment(body: unknown): {
  valid: boolean;
  errors: ValidationError[];
  data?: {
    receiver_id: string;
    amount: number;
    description: string | null;
    chat_id: string | null;
    idempotency_key: string;
  };
} {
  const errors: ValidationError[] = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: [{ field: "body", message: "Request body is required" }] };
  }

  const b = body as Record<string, unknown>;

  // receiver_id
  if (!isValidUUID(b.receiver_id)) {
    errors.push({ field: "receiver_id", message: "Valid UUID required" });
  }

  // amount
  const amountResult = validateAmount(b.amount);
  if (!amountResult.valid) {
    errors.push({ field: "amount", message: amountResult.error! });
  }

  // idempotency_key
  if (!isValidIdempotencyKey(b.idempotency_key)) {
    errors.push({
      field: "idempotency_key",
      message: "Required: 16-64 alphanumeric characters, dashes, or underscores",
    });
  }

  // Optional: chat_id
  if (b.chat_id !== undefined && b.chat_id !== null && !isValidUUID(b.chat_id)) {
    errors.push({ field: "chat_id", message: "Must be a valid UUID if provided" });
  }

  // Optional: description
  const description = sanitizeString(b.description, 280);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      receiver_id: b.receiver_id as string,
      amount: amountResult.amount,
      description,
      chat_id: b.chat_id ? (b.chat_id as string) : null,
      idempotency_key: b.idempotency_key as string,
    },
  };
}
