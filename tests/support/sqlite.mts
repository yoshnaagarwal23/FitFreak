// A minimal stand-in for expo-sqlite's async API, backed by Node's built-in SQLite,
// so database code can be tested without a browser or phone.
import { DatabaseSync } from 'node:sqlite';

export function openTestDb() {
  const raw = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, ...p: any[]) => {
      const r = raw.prepare(sql).run(...p);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    getFirstAsync: async (sql: string, ...p: any[]) => {
      const r = raw.prepare(sql).get(...p);
      return r ? { ...r } : null;
    },
    getAllAsync: async (sql: string, ...p: any[]) => raw.prepare(sql).all(...p).map((r: any) => ({ ...r })),
    withTransactionAsync: async (fn: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await fn();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  } as any;
  return { raw, db };
}
