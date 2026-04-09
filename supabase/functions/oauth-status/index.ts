import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { authenticate, adminClient, AuthError } from '../_shared/auth.ts';

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'GET') return err(req, 'Method not allowed', 'METHOD_NOT_ALLOWED', 405);

  try {
    const user = await authenticate(req);
    const { data } = await adminClient.from('mp_auth')
      .select('mp_email, mp_user_id, created_at, last_used_at')
      .eq('user_id', user.id).eq('is_active', true).maybeSingle();

    return ok(req, {
      connected: !!data, mp_email: data?.mp_email || null,
      mp_user_id: data?.mp_user_id || null,
      connected_at: data?.created_at || null,
      last_used_at: data?.last_used_at || null,
    });
  } catch (e) {
    if (e instanceof AuthError) return err(req, e.message, 'AUTH_FAILED', 401);
    return err(req, 'Error interno', 'INTERNAL', 500);
  }
});
