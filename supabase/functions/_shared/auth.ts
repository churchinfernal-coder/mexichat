import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export { adminClient };

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  identifier: string;
  jwt: string;
}

export async function authenticate(req: Request): Promise<AuthUser> {
  const header = req.headers.get('Authorization');
  if (!header) throw new AuthError('Token requerido');

  const jwt = header.replace('Bearer ', '').trim();
  if (!jwt) throw new AuthError('Token vacio');

  const { data: { user }, error } = await adminClient.auth.getUser(jwt);
  if (error || !user) throw new AuthError(error?.message || 'Token invalido');

  // Accept either email or phone - hybrid auth support
  const email = user.email || null;
  const phone = user.phone || null;
  const identifier = email || phone || user.id;

  if (!email && !phone) throw new AuthError('Usuario sin email ni telefono');

  return { id: user.id, email, phone, identifier, jwt };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}