import type { SupabaseClient } from '@supabase/supabase-js';

// The parts of the Supabase client the data layer uses. Every function in src/db takes
// one of these, so tests can pass a plain PostgREST client pointed at a local database.
// Row-level security decides whose rows a query sees; the code never filters by user.
export type Db = Pick<SupabaseClient, 'from' | 'rpc'>;

// Unwraps a Supabase response, turning an error result into a thrown Error. There are no
// generated database types, so the result takes the row type the caller declares.
export function must<T = void>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// Escapes LIKE wildcards so user input matches literally.
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
