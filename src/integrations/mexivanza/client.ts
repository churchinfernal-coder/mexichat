/**
 * MEXIVANZA — Supabase Client (read-only for community data)
 *
 * MexiVanza is a separate Supabase project. This client is used to:
 *  1. Auto-register MexiChat users on MexiVanza
 *  2. Pull Comunidad (posts/community) data in real-time
 */

import { createClient } from '@supabase/supabase-js';

const MEXIVANZA_URL = 'https://jxhipmpbnihgqbktkggr.supabase.co';
const MEXIVANZA_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aGlwbXBibmloZ3Fia3RrZ2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MjU0MzcsImV4cCI6MjA3NTMwMTQzN30.vYa4Sa5B00mJYLtT8h20HisVKf9v8uqjMQU_47ubEGo';

export const mexivanza = createClient(MEXIVANZA_URL, MEXIVANZA_ANON_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'sb-mexivanza-auth-token',
  },
});

export { MEXIVANZA_URL, MEXIVANZA_ANON_KEY };
