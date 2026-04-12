// ╔══════════════════════════════════════════════════════════════╗
// ║  GET /functions/v1/oauth-callback?code=xxx&state=xxx        ║
// ║  Mercado Pago OAuth callback. Exchanges code for tokens.    ║
// ║  Redirects to frontend.                                     ║
// ╚══════════════════════════════════════════════════════════════╝

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase-client.ts";
import { exchangeCodeForTokens, MPApiError } from "../_shared/mercadopago.ts";

serve(async (req: Request): Promise<Response> => {
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:3000";

  // Only GET (browser redirect from Mercado Pago)
  if (req.method !== "GET") {
    return Response.redirect(`${frontendUrl}/pagos?error=method_not_allowed`, 302);
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return Response.redirect(`${frontendUrl}/pagos?error=missing_params`, 302);
    }

    // ── Decode state to get user ID ──
    let userId: string;
    try {
      const decoded = JSON.parse(atob(state));
      userId = decoded.uid;

      // Verify state isn't too old (15 minutes max)
      if (Date.now() - decoded.ts > 15 * 60 * 1000) {
        return Response.redirect(`${frontendUrl}/pagos?error=state_expired`, 302);
      }
    } catch {
      return Response.redirect(`${frontendUrl}/pagos?error=invalid_state`, 302);
    }

    if (!userId) {
      return Response.redirect(`${frontendUrl}/pagos?error=no_user_id`, 302);
    }

    // ── Exchange code for tokens ──
    let tokens;
    try {
      tokens = await exchangeCodeForTokens(code);
    } catch (mpError) {
      console.error("Token exchange failed:", mpError);
      const detail = mpError instanceof MPApiError ? mpError.statusCode.toString() : "unknown";
      return Response.redirect(`${frontendUrl}/pagos?error=token_exchange_failed&detail=${detail}`, 302);
    }

    // ── Upsert MP auth record (service_role bypasses RLS) ──
    const { error: dbError } = await supabaseAdmin
      .from("mp_auth")
      .upsert(
        {
          user_id: userId,
          mp_access_token: tokens.access_token,
          mp_refresh_token: tokens.refresh_token,
          mp_user_id: tokens.user_id.toString(),
          mp_email: null, // MP doesn't always return email in token exchange
          mp_public_key: tokens.public_key || null,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          scopes: tokens.scope ? tokens.scope.split(" ") : [],
          is_active: true,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (dbError) {
      console.error("DB upsert failed:", dbError);
      return Response.redirect(`${frontendUrl}/pagos?error=db_error`, 302);
    }

    return Response.redirect(`${frontendUrl}/pagos?connected=true`, 302);

  } catch (error) {
    console.error("Unhandled oauth-callback error:", error);
    return Response.redirect(`${frontendUrl}/pagos?error=internal`, 302);
  }
});
