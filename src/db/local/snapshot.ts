import type { SQLiteDatabase } from 'expo-sqlite';

import { migrate } from './migrations';

// Before accounts, everything lived in SQLite in the browser. This reads it all so it
// can be copied into the user's account once (see import_local_data in supabase/).

export const LOCAL_DATABASE_NAME = 'fitfreak.db';

const TABLES = [
  'exercises',
  'foods',
  'water_logs',
  'split_plans',
  'split_days',
  'split_day_exercises',
  'workouts',
  'workout_exercises',
  'workout_sets',
  'food_logs',
] as const;

type Row = Record<string, unknown>;

export type LocalSnapshot = Record<(typeof TABLES)[number], Row[]> & {
  settings: { units?: string; water_goal_glasses?: number; macro_settings?: unknown };
};

// Null if this browser never stored anything.
export async function readLocalSnapshot(db: SQLiteDatabase): Promise<LocalSnapshot | null> {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (!version || version.user_version === 0) return null;
  await migrate(db); // an older local database gets the latest schema first

  const snapshot = { settings: {} } as LocalSnapshot;
  for (const table of TABLES) {
    snapshot[table] = await db.getAllAsync<Row>(`SELECT * FROM ${table}`);
  }

  const settings = new Map(
    (await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings')).map((r) => [
      r.key,
      r.value,
    ]),
  );
  const units = settings.get('units');
  if (units === 'metric' || units === 'imperial') snapshot.settings.units = units;
  const goal = Number(settings.get('water_goal_glasses'));
  if (Number.isInteger(goal) && goal >= 1 && goal <= 20) snapshot.settings.water_goal_glasses = goal;
  try {
    const macro = JSON.parse(settings.get('macro_settings') ?? 'null');
    if (macro?.mode === 'auto' || macro?.mode === 'manual') snapshot.settings.macro_settings = macro;
  } catch {
    // unreadable settings are left behind
  }
  return snapshot;
}

export function summarize(s: LocalSnapshot) {
  const workoutOf = new Map(s.workout_exercises.map((we) => [we.id, we.workout_id]));
  const withSets = new Set(s.workout_sets.map((set) => workoutOf.get(set.workout_exercise_id)));
  return {
    workouts: s.workouts.filter((w) => withSets.has(w.id)).length,
    sets: s.workout_sets.length,
    foodLogs: s.food_logs.length,
    waterLogs: s.water_logs.length,
    splits: s.split_plans.length,
  };
}

export const hasData = (s: LocalSnapshot) =>
  Object.values(summarize(s)).some((n) => n > 0) || Object.keys(s.settings).length > 0;

// Remembers, in the local database itself, which account this browser's data went to.
const MARK_KEY = 'cloud_import';

export async function getImportMark(db: SQLiteDatabase): Promise<{ email: string; at: string } | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', MARK_KEY);
  try {
    return row ? JSON.parse(row.value) : null;
  } catch {
    return null;
  }
}

export async function setImportMark(db: SQLiteDatabase, email: string) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    MARK_KEY,
    JSON.stringify({ email, at: new Date().toISOString() }),
  );
}
