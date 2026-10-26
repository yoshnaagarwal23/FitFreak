import { useFocusEffect } from 'expo-router';
import type { Db } from '@/db/client';
import { useDb } from '@/db/supabase';
import { useCallback, useState } from 'react';

// Runs a database query whenever the screen gains focus and exposes `reload` for after writes.
// `data` is undefined until the first load finishes.
// `query` must be stable — a module-level function, or wrapped in useCallback.
export function useFocusQuery<T>(query: (db: Db) => Promise<T>) {
  const db = useDb();
  const [data, setData] = useState<T | undefined>(undefined);

  const reload = useCallback(async () => {
    setData(await query(db));
  }, [db, query]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { db, data, reload };
}
