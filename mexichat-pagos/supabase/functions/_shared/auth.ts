// ╔══════════════════════════════════════════════════════════════╗
// ║  Authentication & Authorization Middleware                   ║
// ║  Validates Supabase JWT, extracts user, enforces auth       ║
// ╚══════════════════════════════════════════════════════════════╝

import { supabaseAdmin } from "./supabase-client.ts";

export interface AuthenticatedUser {
  id: string;
  email: string;
  jwt: string;
}

/**
 * Extracts and validates the Supabase JWT from the Authorization header.
 * Returns the authenticated user or throws a structured error.
 */
export async function authenticateRequest(req: Request): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw createAuthError("Missing Authorization header", "AUTH_MISSING");
  }

  const jwt = authHeader.replace("Bearer ", "").trim();
  if (!jwt || jwt === "Bearer") {
    throw createAuthError("Malformed Authorization header", "AUTH_MALFORMED");
  }

  // Validate with Supabase Auth — this verifies signature, expiry, etc.
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt);

  if (error || !user) {
    throw createAuthError(
      error?.message || "Invalid or expired token",
      "AUTH_INVALID"
    );
  }

  if (!user.email) {
    throw createAuthError("User has no email associated", "AUTH_NO_EMAIL");
  }

  return {
    id: user.id,
    email: user.email,
    jwt,
  };
}

function createAuthError(message: string, code: string): Response {
  return new Response(
    JSON.stringify({ error: message, code }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
}
