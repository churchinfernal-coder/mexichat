// ╔══════════════════════════════════════════════════════════════╗
// ║  GET /functions/v1/oauth-connect                            ║
// ║  Returns Mercado Pago OAuth authorization URL                ║
// ╚══════════════════════════════════════════════════════════════╝

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse(req, "Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }

  try {
    const user = await authenticateRequest(req);
    if (user instanceof Response) return user;

    const clientId = Deno.env.get("MP_CLIENT_ID");
    const redirectUri = Deno.env.get("MP_REDIRECT_URI");

    if (!clientId || !redirectUri) {
      console.error("Missing MP_CLIENT_ID or MP_REDIRECT_URI");
      return errorResponse(req, "Payment provider not configured", "CONFIG_ERROR", 503);
    }

    // State parameter: base64-encode user ID for CSRF-like protection
    const state = btoa(JSON.stringify({ uid: user.id, ts: Date.now() }));

    const authUrl =
      `https://auth.mercadopago.com.mx/authorization` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code` +
      `&platform_id=mp` +
      `&state=${encodeURIComponent(state)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return jsonResponse(req, { auth_url: authUrl });

  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unhandled error in oauth-connect:", error);
    return errorResponse(req, "Internal server error", "INTERNAL_ERROR", 500);
  }
});
