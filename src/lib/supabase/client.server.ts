// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
// For user-authenticated queries (with RLS), use auth-middleware instead.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const DEFAULT_SUPABASE_URL = 'https://tivecvbokrkooaznfjdy.supabase.co';

export function createSupabaseAdminClient() {
  const procEnv = (typeof process !== 'undefined' && process.env) || {};
  const SUPABASE_URL = procEnv.SUPABASE_URL || procEnv.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = procEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing: string[] = [];
    if (!SUPABASE_URL) missing.push('SUPABASE_URL / VITE_SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

    const message = `[Spariom-CRM] Missing Supabase server environment variable(s): ${missing.join(', ')}. Server admin functions require SUPABASE_SERVICE_ROLE_KEY in .env.`;
    console.error(message);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

// Server-side Supabase client with service role - bypasses RLS
// SECURITY: Only use this for trusted server-side operations, never expose to client code
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createSupabaseAdminClient();
    }
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
