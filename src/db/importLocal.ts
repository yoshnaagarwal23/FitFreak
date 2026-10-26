import { must, type Db } from './client';
import type { LocalSnapshot } from './local/snapshot';

export type ImportResult = { workouts: number; sets: number; food_logs: number; water_logs: number };

// Copies a local snapshot into the signed-in user's account in one transaction.
// The database refuses a second import into the same account.
export async function importLocalData(db: Db, snapshot: LocalSnapshot): Promise<ImportResult> {
  return must(await db.rpc('import_local_data', { p_data: snapshot }));
}
