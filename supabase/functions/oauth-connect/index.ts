import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { authenticate, AuthError } from '../_shared/auth.ts';

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'GET') return err(req, 'Method not allowed', 'METHOD_NOT_ALLOWED', 405);

  try {
    const user = await authenticate(req);
    const clientId = Deno.env.get('MP_CLIENT_ID');
    const frontendUrl = Deno.env.get('FRONTEND_URL');
    if (!clientId || !frontendUrl) return err(req, 'Proveedor no configurado', 'CONFIG_ERROR', 503);

    const redirectUri = Deno.env.get('MP_REDIRECT_URI') || `${frontendUrl}/pagos/oauth-callback`;
    const state = btoa(JSON.stringify({ uid: user.id, ts: Date.now() }));
    const authUrl = `https://auth.mercadopago.com.mx/authorization?client_id=${encodeURIComponent(clientId)}&response_type=code&platform_id=mp&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    return ok(req, { auth_url: authUrl });
  } catch (e) {
    if (e instanceof AuthError) return err(req, e.message, 'AUTH_FAILED', 401);
    return err(req, 'Error interno', 'INTERNAL', 500);
  }
});