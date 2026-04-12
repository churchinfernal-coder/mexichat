// ╔══════════════════════════════════════════════════════════════╗
// ║  GET /functions/v1/payment-history                          ║
// ║  Paginated transaction history. RLS-enforced.               ║
// ╚══════════════════════════════════════════════════════════════╝

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { supabaseForUser } from "../_shared/supabase-client.ts";

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse(req, "Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }

  try {
    const user = await authenticateRequest(req);
    if (user instanceof Response) return user;

    // Parse query params
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const statusFilter = url.searchParams.get("status");
    const offset = (page - 1) * limit;

    // Build query — RLS enforces sender_id OR receiver_id = auth.uid()
    const userSupabase = supabaseForUser(user.jwt);
    let query = userSupabase
      .from("transactions")
      .select("*", { count: "exact" })
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Optional status filter
    if (statusFilter && ["pending", "approved", "rejected", "cancelled", "refunded"].includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error("History query failed:", error);
      return errorResponse(req, "Failed to fetch history", "QUERY_FAILED", 500);
    }

    return jsonResponse(req, {
      transactions: transactions || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
        has_next: page < Math.ceil((count || 0) / limit),
        has_prev: page > 1,
      },
    });

  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unhandled error in payment-history:", error);
    return errorResponse(req, "Internal server error", "INTERNAL_ERROR", 500);
  }
});
