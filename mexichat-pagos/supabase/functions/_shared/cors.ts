// ╔══════════════════════════════════════════════════════════════╗
// ║  CORS Headers                                               ║
// ╚══════════════════════════════════════════════════════════════╝

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  Deno.env.get("FRONTEND_URL") || "",
].filter(Boolean);

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Idempotency-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  return null;
}
