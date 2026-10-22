import type { SQLiteDatabase } from 'expo-sqlite';

import { toDateKey } from '@/lib/date';
import { clampGoal, DEFAULT_GOAL_GLASSES } from '@/lib/water';

import { getSetting, setSetting } from './settings';

const GOAL_KEY = 'water_goal_glasses';

export async function getTotalMl(db: SQLiteDatabase, dateKey: string): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(amount_ml) AS total FROM water_logs WHERE logged_on = ?',
    dateKey,
  );
  return row?.total ?? 0;
}

export async function addWater(db: SQLiteDatabase, amountMl: number, at: Date = new Date()) {
  await db.runAsync(
    'INSERT INTO water_logs (logged_on, logged_at, amount_ml) VALUES (?, ?, ?)',
    toDateKey(at),
    at.toISOString(),
    amountMl,
  );
}

// Removes the most recent entry for the given day (undo).
export async function removeLatestWater(db: SQLiteDatabase, dateKey: string) {
  await db.runAsync(
    `DELETE FROM water_logs WHERE id = (
       SELECT id FROM water_logs WHERE logged_on = ? ORDER BY logged_at DESC, id DESC LIMIT 1
     )`,
    dateKey,
  );
}

export async function getGoalGlasses(db: SQLiteDatabase): Promise<number> {
  const value = await getSetting(db, GOAL_KEY);
  return value === null ? DEFAULT_GOAL_GLASSES : clampGoal(Number(value));
}

export async function setGoalGlasses(db: SQLiteDatabase, glasses: number) {
  await setSetting(db, GOAL_KEY, String(clampGoal(glasses)));
}
