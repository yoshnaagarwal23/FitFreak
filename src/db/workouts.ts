import type { SQLiteDatabase } from 'expo-sqlite';

import { toDateKey } from '@/lib/date';
import type { SetEntry } from '@/lib/workout';

export type Workout = {
  id: number;
  performedOn: string;
  startedAt: string;
  finishedAt: string | null;
};

const WORKOUT_COLUMNS =
  'id, performed_on AS performedOn, started_at AS startedAt, finished_at AS finishedAt';

export async function getActiveWorkout(db: SQLiteDatabase): Promise<Workout | null> {
  return db.getFirstAsync<Workout>(
    `SELECT ${WORKOUT_COLUMNS} FROM workouts WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1`,
  );
}

// Only one workout can be in progress; returns it instead of starting another.
export async function startWorkout(db: SQLiteDatabase, at: Date = new Date()): Promise<number> {
  const active = await getActiveWorkout(db);
  if (active) return active.id;
  const result = await db.runAsync(
    'INSERT INTO workouts (performed_on, started_at) VALUES (?, ?)',
    toDateKey(at),
    at.toISOString(),
  );
  return result.lastInsertRowId;
}

// Starts a workout pre-filled with a split day's exercises and their targets.
// If a workout is already in progress, returns that one instead.
export async function startWorkoutFromSplitDay(
  db: SQLiteDatabase,
  splitDayId: number,
  at: Date = new Date(),
): Promise<number> {
  const active = await getActiveWorkout(db);
  if (active) return active.id;

  let workoutId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'INSERT INTO workouts (performed_on, started_at, split_day_id) VALUES (?, ?, ?)',
      toDateKey(at),
      at.toISOString(),
      splitDayId,
    );
    workoutId = result.lastInsertRowId;
    await db.runAsync(
      `INSERT INTO workout_exercises
         (workout_id, exercise_id, position, target_sets, target_reps_min, target_reps_max)
       SELECT ?, exercise_id, position + 1, sets, reps_min, reps_max
       FROM split_day_exercises WHERE split_day_id = ? ORDER BY position`,
      workoutId,
      splitDayId,
    );
  });
  return workoutId;
}

// Finishing a workout with no sets discards it.
export async function finishWorkout(db: SQLiteDatabase, workoutId: number, at: Date = new Date()) {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM workout_sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     WHERE we.workout_id = ?`,
    workoutId,
  );
  if ((row?.n ?? 0) === 0) {
    await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
  } else {
    await db.runAsync('UPDATE workouts SET finished_at = ? WHERE id = ?', at.toISOString(), workoutId);
  }
}

export type LoggedSet = SetEntry & { id: number; setNumber: number };

export type WorkoutExercise = {
  id: number; // workout_exercises.id
  exerciseId: number;
  name: string;
  target: Target | null; // set when the workout was started from a split day
  sets: LoggedSet[];
  lastSet: SetEntry | null; // most recent set of this exercise in any workout, for prefilling
};

export type Target = { sets: number; repsMin: number; repsMax: number };

export type WorkoutDetail = Workout & { splitDayTitle: string | null; exercises: WorkoutExercise[] };

export async function getWorkoutDetail(
  db: SQLiteDatabase,
  workoutId: number,
): Promise<WorkoutDetail | null> {
  const workout = await db.getFirstAsync<Workout & { splitDayTitle: string | null }>(
    `SELECT w.id, w.performed_on AS performedOn, w.started_at AS startedAt,
            w.finished_at AS finishedAt, d.title AS splitDayTitle
     FROM workouts w LEFT JOIN split_days d ON d.id = w.split_day_id
     WHERE w.id = ?`,
    workoutId,
  );
  if (!workout) return null;

  const exercises = await db.getAllAsync<{
    id: number;
    exerciseId: number;
    name: string;
    targetSets: number | null;
    targetRepsMin: number | null;
    targetRepsMax: number | null;
  }>(
    `SELECT we.id, we.exercise_id AS exerciseId, e.name, we.target_sets AS targetSets,
            we.target_reps_min AS targetRepsMin, we.target_reps_max AS targetRepsMax
     FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ? ORDER BY we.position`,
    workoutId,
  );
  const sets = await db.getAllAsync<LoggedSet & { workoutExerciseId: number }>(
    `SELECT s.id, s.workout_exercise_id AS workoutExerciseId, s.set_number AS setNumber,
            s.reps, s.weight_kg AS weightKg
     FROM workout_sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     WHERE we.workout_id = ? ORDER BY s.set_number`,
    workoutId,
  );

  const result: WorkoutExercise[] = [];
  for (const { targetSets, targetRepsMin, targetRepsMax, ...ex } of exercises) {
    result.push({
      ...ex,
      target:
        targetSets !== null && targetRepsMin !== null && targetRepsMax !== null
          ? { sets: targetSets, repsMin: targetRepsMin, repsMax: targetRepsMax }
          : null,
      sets: sets
        .filter((s) => s.workoutExerciseId === ex.id)
        .map(({ id, setNumber, reps, weightKg }) => ({ id, setNumber, reps, weightKg })),
      lastSet: await getLastSet(db, ex.exerciseId),
    });
  }
  return { ...workout, exercises: result };
}

async function getLastSet(db: SQLiteDatabase, exerciseId: number): Promise<SetEntry | null> {
  return db.getFirstAsync<SetEntry>(
    `SELECT s.weight_kg AS weightKg, s.reps
     FROM workout_sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     WHERE we.exercise_id = ? ORDER BY s.logged_at DESC, s.id DESC LIMIT 1`,
    exerciseId,
  );
}

export async function addExerciseToWorkout(
  db: SQLiteDatabase,
  workoutId: number,
  exerciseId: number,
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO workout_exercises (workout_id, exercise_id, position)
     VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM workout_exercises WHERE workout_id = ?))`,
    workoutId,
    exerciseId,
    workoutId,
  );
}

export async function removeExerciseFromWorkout(db: SQLiteDatabase, workoutExerciseId: number) {
  await db.runAsync('DELETE FROM workout_exercises WHERE id = ?', workoutExerciseId);
}

export async function addSet(
  db: SQLiteDatabase,
  workoutExerciseId: number,
  { weightKg, reps }: SetEntry,
  at: Date = new Date(),
) {
  await db.runAsync(
    `INSERT INTO workout_sets (workout_exercise_id, set_number, reps, weight_kg, logged_at)
     VALUES (?, (SELECT COUNT(*) + 1 FROM workout_sets WHERE workout_exercise_id = ?), ?, ?, ?)`,
    workoutExerciseId,
    workoutExerciseId,
    reps,
    weightKg,
    at.toISOString(),
  );
}

// Deletes a set and renumbers the remaining sets of that exercise 1..n.
export async function deleteSet(db: SQLiteDatabase, setId: number) {
  const row = await db.getFirstAsync<{ weId: number }>(
    'SELECT workout_exercise_id AS weId FROM workout_sets WHERE id = ?',
    setId,
  );
  if (!row) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM workout_sets WHERE id = ?', setId);
    await db.runAsync(
      `UPDATE workout_sets SET set_number = (
         SELECT COUNT(*) FROM workout_sets s2
         WHERE s2.workout_exercise_id = workout_sets.workout_exercise_id AND s2.id <= workout_sets.id
       ) WHERE workout_exercise_id = ?`,
      row.weId,
    );
  });
}

export type WorkoutSummary = Workout & {
  exerciseCount: number;
  setCount: number;
  volumeKg: number;
};

export async function getRecentWorkouts(db: SQLiteDatabase, limit = 20): Promise<WorkoutSummary[]> {
  return db.getAllAsync<WorkoutSummary>(
    `SELECT w.id, w.performed_on AS performedOn, w.started_at AS startedAt, w.finished_at AS finishedAt,
            COUNT(DISTINCT s.workout_exercise_id) AS exerciseCount,
            COUNT(s.id) AS setCount,
            COALESCE(SUM(s.weight_kg * s.reps), 0) AS volumeKg
     FROM workouts w
     LEFT JOIN workout_exercises we ON we.workout_id = w.id
     LEFT JOIN workout_sets s ON s.workout_exercise_id = we.id
     WHERE w.finished_at IS NOT NULL
     GROUP BY w.id
     ORDER BY w.started_at DESC
     LIMIT ?`,
    limit,
  );
}
