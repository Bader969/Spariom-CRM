import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const procEnv = (typeof process !== 'undefined' && process.env) || {};
    const SUPABASE_URL = procEnv.SUPABASE_URL || procEnv.VITE_SUPABASE_URL;
    const SUPABASE_KEY = 
      procEnv.SUPABASE_PUBLISHABLE_KEY || 
      procEnv.VITE_SUPABASE_ANON_KEY || 
      procEnv.SUPABASE_ANON_KEY || 
      procEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      const missing: string[] = [];
      if (!SUPABASE_URL) missing.push('SUPABASE_URL / VITE_SUPABASE_URL');
      if (!SUPABASE_KEY) missing.push('SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY');

      const message = `[Spariom-CRM] Missing Supabase environment variable(s): ${missing.join(', ')}. Please configure .env`;
      console.error(message);
      throw new Error(message);
    }

    const request = getRequest();

    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available');
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header provided');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized: Only Bearer tokens are supported');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new Error('Unauthorized: No token provided');
    }

    const supabase = createClient<Database>(
      SUPABASE_URL!,
      SUPABASE_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      throw new Error('Unauthorized: Invalid token');
    }

    if (!data.claims.sub) {
      throw new Error('Unauthorized: No user ID found in token');
    }

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
      },
    });
  },
);
