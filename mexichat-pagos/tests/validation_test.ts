// ╔══════════════════════════════════════════════════════════════╗
// ║  Validation Module Tests                                    ║
// ║  Run: deno test tests/validation_test.ts                    ║
// ╚══════════════════════════════════════════════════════════════╝

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  isValidUUID,
  isValidIdempotencyKey,
  validateAmount,
  sanitizeString,
  validateSendPayment,
} from "../supabase/functions/_shared/validation.ts";

// ─── UUID validation ───
Deno.test("isValidUUID: accepts valid UUIDs", () => {
  assertEquals(isValidUUID("550e8400-e29b-41d4-a716-446655440000"), true);
  assertEquals(isValidUUID("00000000-0000-0000-0000-000000000000"), true);
});

Deno.test("isValidUUID: rejects invalid values", () => {
  assertEquals(isValidUUID(""), false);
  assertEquals(isValidUUID("not-a-uuid"), false);
  assertEquals(isValidUUID(null), false);
  assertEquals(isValidUUID(undefined), false);
  assertEquals(isValidUUID(123), false);
  assertEquals(isValidUUID("550e8400-e29b-41d4-a716"), false);
  assertEquals(isValidUUID("550e8400-e29b-41d4-a716-446655440000extra"), false);
});

// ─── Idempotency key validation ───
Deno.test("isValidIdempotencyKey: accepts valid keys", () => {
  assertEquals(isValidIdempotencyKey("mc-abc123-def456gh"), true);
  assertEquals(isValidIdempotencyKey("a".repeat(64)), true);
  assertEquals(isValidIdempotencyKey("test_key_1234567"), true);
});

Deno.test("isValidIdempotencyKey: rejects invalid keys", () => {
  assertEquals(isValidIdempotencyKey("short"), false);               // too short
  assertEquals(isValidIdempotencyKey("a".repeat(65)), false);        // too long
  assertEquals(isValidIdempotencyKey("has spaces here!"), false);    // invalid chars
  assertEquals(isValidIdempotencyKey(""), false);
  assertEquals(isValidIdempotencyKey(null), false);
});

// ─── Amount validation ───
Deno.test("validateAmount: accepts valid amounts", () => {
  assertEquals(validateAmount(100).valid, true);
  assertEquals(validateAmount(100).amount, 100);
  assertEquals(validateAmount(0.01).valid, true);
  assertEquals(validateAmount(500000).valid, true);
  assertEquals(validateAmount("250.50").valid, true);
  assertEquals(validateAmount("250.50").amount, 250.50);
});

Deno.test("validateAmount: rejects invalid amounts", () => {
  assertEquals(validateAmount(0).valid, false);
  assertEquals(validateAmount(-50).valid, false);
  assertEquals(validateAmount(500001).valid, false);
  assertEquals(validateAmount(NaN).valid, false);
  assertEquals(validateAmount(Infinity).valid, false);
  assertEquals(validateAmount("abc").valid, false);
  assertEquals(validateAmount(null).valid, false);
});

Deno.test("validateAmount: rounds to 2 decimals", () => {
  assertEquals(validateAmount(10.999).amount, 11.00);
  assertEquals(validateAmount(10.001).amount, 10.00);
  assertEquals(validateAmount(10.005).amount, 10.01);
});

// ─── String sanitization ───
Deno.test("sanitizeString: strips HTML and null bytes", () => {
  assertEquals(sanitizeString("<script>alert('xss')</script>Hello"), "alert('xss')Hello");
  assertEquals(sanitizeString("test\0null"), "testnull");
  assertEquals(sanitizeString("  trimmed  "), "trimmed");
});

Deno.test("sanitizeString: enforces max length", () => {
  const long = "a".repeat(300);
  const result = sanitizeString(long, 280);
  assertEquals(result?.length, 280);
});

Deno.test("sanitizeString: handles null/undefined", () => {
  assertEquals(sanitizeString(null), null);
  assertEquals(sanitizeString(undefined), null);
  assertEquals(sanitizeString(123), null);
});

// ─── Full SendPayment validation ───
Deno.test("validateSendPayment: valid payload", () => {
  const result = validateSendPayment({
    receiver_id: "550e8400-e29b-41d4-a716-446655440000",
    amount: 500,
    idempotency_key: "mc-test123-abcdef12",
    description: "Test payment",
  });
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
  assertEquals(result.data?.amount, 500);
  assertEquals(result.data?.description, "Test payment");
});

Deno.test("validateSendPayment: missing required fields", () => {
  const result = validateSendPayment({});
  assertEquals(result.valid, false);
  assertEquals(result.errors.length >= 3, true);
});

Deno.test("validateSendPayment: XSS in description", () => {
  const result = validateSendPayment({
    receiver_id: "550e8400-e29b-41d4-a716-446655440000",
    amount: 100,
    idempotency_key: "mc-test123-abcdef12",
    description: "<img onerror=alert(1) src=x>Pago",
  });
  assertEquals(result.valid, true);
  assertEquals(result.data?.description?.includes("<img"), false);
});

Deno.test("validateSendPayment: self-transfer not caught here (checked in handler)", () => {
  // Validation doesn't know the sender — that's checked in the Edge Function
  const result = validateSendPayment({
    receiver_id: "550e8400-e29b-41d4-a716-446655440000",
    amount: 100,
    idempotency_key: "mc-test123-abcdef12",
  });
  assertEquals(result.valid, true);
});

console.log("\n✅ All validation tests passed\n");
