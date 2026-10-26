import { createClient } from '@supabase/supabase-js';

import type { Db } from './client';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
if (!url || !key) {
  throw new Error('Supabase is not configured: copy .env.example to .env.local and fill it in, then restart Expo.');
}

// The publishable key is safe to ship in the app: on its own it can only read built-in
// foods and exercises. Everything else needs a signed-in user, and row-level security
// limits them to their own rows. On the web the session is kept in localStorage.
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Hook form so screens read like other context consumers; there is one client app-wide.
export function useDb(): Db {
  return supabase;
}
