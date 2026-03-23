import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { authenticate, AuthError } from '../_shared/auth.ts';

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'GET') return err(req, 'Method not allowed', 'METHOD_NOT_ALLOWED', 405);

  try {
    const user = await authenticate(req);
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;
    const statusFilter = url.searchParams.get('status');

    const uc = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${user.jwt}` } },
        auth: { autoRefreshToken: false, persistSession: false } }
    );

    let q = uc.from('transactions')
      .select('*, sender:profiles!transactions_sender_id_fkey(full_name,username,avatar_url), receiver:profiles!transactions_receiver_id_fkey(full_name,username,avatar_url)', { count: 'exact' })
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const validStatuses = ['pending', 'approved', 'rejected', 'cancelled', 'refunded', 'in_process', 'charged_back'];
    if (statusFilter && validStatuses.includes(statusFilter)) q = q.eq('status', statusFilter);

    const { data, error: qErr, count } = await q;
    if (qErr) return err(req, 'Error consultando historial', 'QUERY_FAILED', 500, qErr.message);

    return ok(req, {
      transactions: data || [],
      pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit),
        has_next: page < Math.ceil((count || 0) / limit), has_prev: page > 1 },
    });
  } catch (e) {
    if (e instanceof AuthError) return err(req, e.message, 'AUTH_FAILED', 401);
    return err(req, 'Error interno', 'INTERNAL', 500);
  }
});
