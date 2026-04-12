// ╔══════════════════════════════════════════════════════════════╗
// ║  Supabase Client Factory                                    ║
// ║  - Admin client (service_role): bypasses RLS for webhooks   ║
// ║  - User client: respects RLS policies                       ║
// ╚══════════════════════════════════════════════════════════════╝

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

/**
 * Admin client — bypasses RLS. Use ONLY in webhooks and server-side operations.
 * NEVER expose this to the client.
 */
export const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Creates a user-scoped client that respects RLS policies.
 * The user's JWT is passed through so auth.uid() works in policies.
 */
export function supabaseForUser(jwt: string): SupabaseClient {
  if (!SUPABASE_ANON_KEY) throw new Error("FATAL: Missing SUPABASE_ANON_KEY");
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
