import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { authenticate, AuthError } from '../_shared/auth.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'GET') return err(req, 'Method not allowed', 'METHOD_NOT_ALLOWED', 405);

  try {
    const user = await authenticate(req);
    const id = new URL(req.url).searchParams.get('id');
    if (!id || !UUID_RE.test(id)) return err(req, 'ID de transacción válido requerido', 'INVALID_ID');

    const uc = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${user.jwt}` } },
        auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error: qErr } = await uc.from('transactions')
      .select('*, sender:profiles!transactions_sender_id_fkey(full_name,username,avatar_url), receiver:profiles!transactions_receiver_id_fkey(full_name,username,avatar_url)')
      .eq('id', id).maybeSingle();

    if (qErr) return err(req, 'Error consultando transacción', 'QUERY_FAILED', 500);
    if (!data) return err(req, 'Transacción no encontrada', 'NOT_FOUND', 404);
    return ok(req, data);
  } catch (e) {
    if (e instanceof AuthError) return err(req, e.message, 'AUTH_FAILED', 401);
    return err(req, 'Error interno', 'INTERNAL', 500);
  }
});
