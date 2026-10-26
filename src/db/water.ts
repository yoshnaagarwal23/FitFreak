import { toDateKey } from '@/lib/date';
import { clampGoal, DEFAULT_GOAL_GLASSES } from '@/lib/water';

import { must, type Db } from './client';
import { getUserSettings, updateUserSettings } from './settings';

export async function getTotalMl(db: Db, dateKey: string): Promise<number> {
  const rows: { amount_ml: number }[] = must(
    await db.from('water_logs').select('amount_ml').eq('logged_on', dateKey),
  );
  return rows.reduce((sum, r) => sum + r.amount_ml, 0);
}

export async function addWater(db: Db, amountMl: number, at: Date = new Date()) {
  must(
    await db
      .from('water_logs')
      .insert({ logged_on: toDateKey(at), logged_at: at.toISOString(), amount_ml: amountMl }),
  );
}

// Removes the most recent entry for the given day (undo).
export async function removeLatestWater(db: Db, dateKey: string) {
  const latest: { id: number }[] = must(
    await db
      .from('water_logs')
      .select('id')
      .eq('logged_on', dateKey)
      .order('logged_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1),
  );
  if (latest.length === 0) return;
  must(await db.from('water_logs').delete().eq('id', latest[0].id));
}

export async function getGoalGlasses(db: Db): Promise<number> {
  const settings = await getUserSettings(db);
  return settings ? clampGoal(settings.water_goal_glasses) : DEFAULT_GOAL_GLASSES;
}

export async function setGoalGlasses(db: Db, glasses: number) {
  await updateUserSettings(db, { water_goal_glasses: clampGoal(glasses) });
}
