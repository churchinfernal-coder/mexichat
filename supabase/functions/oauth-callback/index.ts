import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { adminClient } from '../_shared/auth.ts';
import { exchangeOAuthCode } from '../_shared/mercadopago.ts';

serve(async (req: Request) => {
  const fe = Deno.env.get('FRONTEND_URL') || 'http://localhost:3000';
  if (req.method !== 'GET') return Response.redirect(`${fe}/pagos?error=method`, 302);

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) return Response.redirect(`${fe}/pagos?error=missing_params`, 302);

    let uid: string;
    try {
      const d = JSON.parse(atob(state));
      uid = d.uid;
      if (Date.now() - d.ts > 15 * 60 * 1000) return Response.redirect(`${fe}/pagos?error=expired`, 302);
    } catch { return Response.redirect(`${fe}/pagos?error=invalid_state`, 302); }

    const tokens = await exchangeOAuthCode(code);

    const { error: dbErr } = await adminClient.from('mp_auth').upsert({
      user_id: uid,
      mp_access_token: tokens.access_token,
      mp_refresh_token: tokens.refresh_token,
      mp_user_id: tokens.user_id.toString(),
      mp_public_key: tokens.public_key || null,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
      is_active: true,
      last_used_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (dbErr) {
      console.error('DB error:', dbErr);
      return Response.redirect(`${fe}/pagos?error=db_error`, 302);
    }
    return Response.redirect(`${fe}/pagos?connected=true`, 302);
  } catch (e) {
    console.error('oauth-callback error:', e);
    return Response.redirect(`${fe}/pagos?error=failed`, 302);
  }
});
