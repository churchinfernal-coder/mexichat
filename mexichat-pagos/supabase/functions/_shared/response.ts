// ╔══════════════════════════════════════════════════════════════╗
// ║  Standardized Response Helpers                              ║
// ║  Consistent JSON structure, security headers, CORS          ║
// ╚══════════════════════════════════════════════════════════════╝

import { getCorsHeaders } from "./cors.ts";

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Request-Id": crypto.randomUUID(),
};

function mergeHeaders(req: Request, extra?: Record<string, string>): Record<string, string> {
  return {
    ...SECURITY_HEADERS,
    ...getCorsHeaders(req),
    "X-Request-Id": crypto.randomUUID(), // Unique per response
    ...extra,
  };
}

export function jsonResponse<T>(req: Request, data: T, status: number = 200): Response {
  return new Response(
    JSON.stringify({ data, error: null, timestamp: new Date().toISOString() }),
    { status, headers: mergeHeaders(req) }
  );
}

export function errorResponse(
  req: Request,
  message: string,
  code: string,
  status: number = 400,
  details?: string
): Response {
  return new Response(
    JSON.stringify({
      data: null,
      error: { message, code, details: details || undefined },
      timestamp: new Date().toISOString(),
    }),
    { status, headers: mergeHeaders(req) }
  );
}

export function validationErrorResponse(
  req: Request,
  errors: Array<{ field: string; message: string }>
): Response {
  return new Response(
    JSON.stringify({
      data: null,
      error: { message: "Validation failed", code: "VALIDATION_ERROR", fields: errors },
      timestamp: new Date().toISOString(),
    }),
    { status: 422, headers: mergeHeaders(req) }
  );
}
