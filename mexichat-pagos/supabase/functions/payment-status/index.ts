// ╔══════════════════════════════════════════════════════════════╗
// ║  GET /functions/v1/payment-status?id=<uuid>                 ║
// ║  Single transaction details. RLS-enforced.                  ║
// ╚══════════════════════════════════════════════════════════════╝

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { supabaseForUser } from "../_shared/supabase-client.ts";
import { isValidUUID } from "../_shared/validation.ts";

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse(req, "Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }

  try {
    const user = await authenticateRequest(req);
    if (user instanceof Response) return user;

    const url = new URL(req.url);
    const txId = url.searchParams.get("id");

    if (!txId || !isValidUUID(txId)) {
      return errorResponse(req, "Valid transaction ID required", "INVALID_ID", 400);
    }

    const userSupabase = supabaseForUser(user.jwt);
    const { data, error } = await userSupabase
      .from("transactions")
      .select("*")
      .eq("id", txId)
      .maybeSingle();

    if (error) {
      console.error("Status query failed:", error);
      return errorResponse(req, "Failed to fetch transaction", "QUERY_FAILED", 500);
    }

    if (!data) {
      return errorResponse(req, "Transaction not found", "NOT_FOUND", 404);
    }

    return jsonResponse(req, data);

  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unhandled error in payment-status:", error);
    return errorResponse(req, "Internal server error", "INTERNAL_ERROR", 500);
  }
});
