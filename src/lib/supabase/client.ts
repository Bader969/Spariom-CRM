import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export function createSupabaseClient() {
  // Client-side Vite build-time replacement via import.meta.env
  // Fall back to process.env for Node/Nitro SSR
  const env = ((typeof import.meta !== 'undefined' && (import.meta as any).env) || {}) as Record<string, string | undefined>;
  const procEnv = ((typeof process !== 'undefined' && process.env) || {}) as Record<string, string | undefined>;

  const SUPABASE_URL = 
    env.VITE_SUPABASE_URL || 
    env.SUPABASE_URL || 
    env.NEXT_PUBLIC_SUPABASE_URL || 
    procEnv.VITE_SUPABASE_URL || 
    procEnv.SUPABASE_URL || 
    procEnv.NEXT_PUBLIC_SUPABASE_URL;

  const SUPABASE_ANON_KEY = 
    env.VITE_SUPABASE_ANON_KEY || 
    env.VITE_SUPABASE_PUBLISHABLE_KEY || 
    env.SUPABASE_ANON_KEY || 
    env.SUPABASE_PUBLISHABLE_KEY || 
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
    procEnv.VITE_SUPABASE_ANON_KEY || 
    procEnv.VITE_SUPABASE_PUBLISHABLE_KEY || 
    procEnv.SUPABASE_ANON_KEY || 
    procEnv.SUPABASE_PUBLISHABLE_KEY || 
    procEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    procEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const missing: string[] = [];
    if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
    if (!SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY');

    const message = `[Spariom-CRM] Missing Supabase environment variable(s): ${missing.join(', ')}. Please configure your .env file with valid credentials.`;
    console.error(message);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Lazy proxy singleton ensures variables are accessed when invoked
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) {
      _supabase = createSupabaseClient();
    }
    return Reflect.get(_supabase, prop, receiver);
  },
});
