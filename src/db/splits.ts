import type { SQLiteDatabase } from 'expo-sqlite';

import {
  DEFAULT_INPUTS,
  DEFAULT_MANUAL_TARGET,
  type SplitInputs,
  type SplitPlan,
  type Target,
} from '@/lib/split';

export type SavedSplitExercise = {
  id: number; // split_day_exercises.id
  exerciseId: number;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
};

export type SavedSplitDay = {
  id: number;
  weekday: number;
  title: string;
  exercises: SavedSplitExercise[];
};

export type SavedSplit = {
  id: number;
  name: string;
  inputs: SplitInputs;
  days: SavedSplitDay[];
};

// Saves a generated plan and makes it the active one. Older plans are kept (inactive)
// because past workouts reference their days.
export async function saveSplit(db: SQLiteDatabase, inputs: SplitInputs, plan: SplitPlan): Promise<number> {
  let planId = 0;
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE split_plans SET is_active = 0 WHERE is_active = 1');
    const result = await db.runAsync(
      'INSERT INTO split_plans (name, inputs_json, created_at, is_active) VALUES (?, ?, ?, 1)',
      plan.name,
      JSON.stringify(inputs),
      new Date().toISOString(),
    );
    planId = result.lastInsertRowId;

    for (const [dayIndex, day] of plan.days.entries()) {
      const dayResult = await db.runAsync(
        'INSERT INTO split_days (plan_id, day_index, weekday, title) VALUES (?, ?, ?, ?)',
        planId,
        dayIndex,
        day.weekday,
        day.title,
      );
      for (const [position, ex] of day.exercises.entries()) {
        const exerciseId = await getExerciseIdByName(db, ex.name);
        await db.runAsync(
          `INSERT INTO split_day_exercises
             (split_day_id, position, exercise_id, sets, reps_min, reps_max, rest_sec)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          dayResult.lastInsertRowId,
          position,
          exerciseId,
          ex.sets,
          ex.repsMin,
          ex.repsMax,
          ex.restSec,
        );
      }
    }
  });
  return planId;
}

async function getExerciseIdByName(db: SQLiteDatabase, name: string): Promise<number> {
  const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE name = ?', name);
  if (!row) throw new Error(`Exercise "${name}" is missing from the library`);
  return row.id;
}

export async function getActiveSplit(db: SQLiteDatabase): Promise<SavedSplit | null> {
  const plan = await db.getFirstAsync<{ id: number; name: string; inputs_json: string }>(
    'SELECT id, name, inputs_json FROM split_plans WHERE is_active = 1 ORDER BY id DESC LIMIT 1',
  );
  if (!plan) return null;

  const days = await db.getAllAsync<{ id: number; weekday: number; title: string }>(
    'SELECT id, weekday, title FROM split_days WHERE plan_id = ? ORDER BY weekday, day_index',
    plan.id,
  );
  const exercises = await db.getAllAsync<SavedSplitExercise & { splitDayId: number }>(
    `SELECT sde.id, sde.split_day_id AS splitDayId, sde.exercise_id AS exerciseId, e.name,
            sde.sets, sde.reps_min AS repsMin, sde.reps_max AS repsMax, sde.rest_sec AS restSec
     FROM split_day_exercises sde
     JOIN split_days d ON d.id = sde.split_day_id
     JOIN exercises e ON e.id = sde.exercise_id
     WHERE d.plan_id = ?
     ORDER BY sde.position`,
    plan.id,
  );

  return {
    id: plan.id,
    name: plan.name,
    inputs: parseInputs(plan.inputs_json),
    days: days.map((d) => ({
      ...d,
      exercises: exercises
        .filter((e) => e.splitDayId === d.id)
        .map(({ splitDayId: _, ...e }) => e),
    })),
  };
}

function parseInputs(json: string): SplitInputs {
  try {
    return { ...DEFAULT_INPUTS, ...JSON.parse(json) };
  } catch {
    return DEFAULT_INPUTS;
  }
}

// ---- Manual editing ----

export type SplitDayDetail = SavedSplitDay & { planId: number };

export async function getSplitDay(db: SQLiteDatabase, splitDayId: number): Promise<SplitDayDetail | null> {
  const day = await db.getFirstAsync<{ id: number; planId: number; weekday: number; title: string }>(
    'SELECT id, plan_id AS planId, weekday, title FROM split_days WHERE id = ?',
    splitDayId,
  );
  if (!day) return null;
  const exercises = await db.getAllAsync<SavedSplitExercise>(
    `SELECT sde.id, sde.exercise_id AS exerciseId, e.name, sde.sets,
            sde.reps_min AS repsMin, sde.reps_max AS repsMax, sde.rest_sec AS restSec
     FROM split_day_exercises sde JOIN exercises e ON e.id = sde.exercise_id
     WHERE sde.split_day_id = ? ORDER BY sde.position`,
    splitDayId,
  );
  return { ...day, exercises };
}

export async function updateSplitDay(
  db: SQLiteDatabase,
  splitDayId: number,
  changes: { title?: string; weekday?: number },
) {
  if (changes.title !== undefined) {
    await db.runAsync('UPDATE split_days SET title = ? WHERE id = ?', changes.title, splitDayId);
  }
  if (changes.weekday !== undefined) {
    await db.runAsync('UPDATE split_days SET weekday = ? WHERE id = ?', changes.weekday, splitDayId);
  }
}

export async function addSplitDay(db: SQLiteDatabase, planId: number, weekday: number): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO split_days (plan_id, day_index, weekday, title)
     VALUES (?, (SELECT COALESCE(MAX(day_index), -1) + 1 FROM split_days WHERE plan_id = ?), ?, 'Custom')`,
    planId,
    planId,
    weekday,
  );
  return result.lastInsertRowId;
}

// Past workouts keep their sets and targets; their split_day_id becomes NULL.
export async function deleteSplitDay(db: SQLiteDatabase, splitDayId: number) {
  await db.runAsync('DELETE FROM split_days WHERE id = ?', splitDayId);
}

// No-op if the exercise is already on that day.
export async function addExerciseToSplitDay(db: SQLiteDatabase, splitDayId: number, exerciseId: number) {
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM split_day_exercises WHERE split_day_id = ? AND exercise_id = ?',
    splitDayId,
    exerciseId,
  );
  if (existing) return;
  const t = DEFAULT_MANUAL_TARGET;
  await db.runAsync(
    `INSERT INTO split_day_exercises
       (split_day_id, position, exercise_id, sets, reps_min, reps_max, rest_sec)
     VALUES (?, (SELECT COALESCE(MAX(position), -1) + 1 FROM split_day_exercises WHERE split_day_id = ?),
             ?, ?, ?, ?, ?)`,
    splitDayId,
    splitDayId,
    exerciseId,
    t.sets,
    t.repsMin,
    t.repsMax,
    t.restSec,
  );
}

export async function removeSplitExercise(db: SQLiteDatabase, rowId: number) {
  await db.runAsync('DELETE FROM split_day_exercises WHERE id = ?', rowId);
}

export async function updateSplitExerciseTarget(db: SQLiteDatabase, rowId: number, target: Target) {
  await db.runAsync(
    'UPDATE split_day_exercises SET sets = ?, reps_min = ?, reps_max = ? WHERE id = ?',
    target.sets,
    target.repsMin,
    target.repsMax,
    rowId,
  );
}

// Swaps an exercise with its neighbour (direction -1 = up, +1 = down).
export async function moveSplitExercise(db: SQLiteDatabase, rowId: number, direction: -1 | 1) {
  const row = await db.getFirstAsync<{ dayId: number; position: number }>(
    'SELECT split_day_id AS dayId, position FROM split_day_exercises WHERE id = ?',
    rowId,
  );
  if (!row) return;
  const neighbour = await db.getFirstAsync<{ id: number; position: number }>(
    direction < 0
      ? `SELECT id, position FROM split_day_exercises
         WHERE split_day_id = ? AND position < ? ORDER BY position DESC LIMIT 1`
      : `SELECT id, position FROM split_day_exercises
         WHERE split_day_id = ? AND position > ? ORDER BY position ASC LIMIT 1`,
    row.dayId,
    row.position,
  );
  if (!neighbour) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE split_day_exercises SET position = ? WHERE id = ?', neighbour.position, rowId);
    await db.runAsync('UPDATE split_day_exercises SET position = ? WHERE id = ?', row.position, neighbour.id);
  });
}
