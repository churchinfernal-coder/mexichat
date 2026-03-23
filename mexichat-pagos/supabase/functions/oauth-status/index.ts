// ╔══════════════════════════════════════════════════════════════╗
// ║  GET /functions/v1/oauth-status                             ║
// ║  Check if user has Mercado Pago connected                   ║
// ╚══════════════════════════════════════════════════════════════╝

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { supabaseAdmin } from "../_shared/supabase-client.ts";

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse(req, "Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }

  try {
    const user = await authenticateRequest(req);
    if (user instanceof Response) return user;

    const { data } = await supabaseAdmin
      .from("mp_auth")
      .select("mp_email, mp_user_id, is_active, created_at, last_used_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    return jsonResponse(req, {
      connected: !!data,
      mp_email: data?.mp_email || null,
      mp_user_id: data?.mp_user_id || null,
      connected_at: data?.created_at || null,
      last_used_at: data?.last_used_at || null,
    });

  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unhandled error in oauth-status:", error);
    return errorResponse(req, "Internal server error", "INTERNAL_ERROR", 500);
  }
});
