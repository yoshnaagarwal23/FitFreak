import type { SQLiteDatabase } from 'expo-sqlite';

import type { Equipment, MuscleGroup, SessionRow } from '@/lib/workout';

export type Exercise = {
  id: number;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  isCustom: boolean;
};

type ExerciseRow = {
  id: number;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  is_custom: number;
};

const toExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  name: r.name,
  muscleGroup: r.muscle_group,
  equipment: r.equipment,
  isCustom: r.is_custom === 1,
});

export async function searchExercises(db: SQLiteDatabase, query: string): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT * FROM exercises WHERE name LIKE ? ESCAPE '\\' ORDER BY muscle_group, name`,
    `%${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`,
  );
  return rows.map(toExercise);
}

export async function getExercise(db: SQLiteDatabase, id: number): Promise<Exercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', id);
  return row ? toExercise(row) : null;
}

// Returns the existing exercise's id if the name is already taken (case-insensitive).
export async function createExercise(db: SQLiteDatabase, name: string): Promise<number> {
  const trimmed = name.trim();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM exercises WHERE name = ?',
    trimmed,
  );
  if (existing) return existing.id;
  const result = await db.runAsync(
    `INSERT INTO exercises (name, muscle_group, equipment, is_custom) VALUES (?, 'other', 'other', 1)`,
    trimmed,
  );
  return result.lastInsertRowId;
}

export type LoggedExercise = {
  id: number;
  name: string;
  sessionCount: number;
  lastPerformedOn: string;
  topWeightKg: number;
};

// Exercises with at least one logged set, most recently trained first.
export async function getLoggedExercises(db: SQLiteDatabase): Promise<LoggedExercise[]> {
  return db.getAllAsync<LoggedExercise>(`
    SELECT e.id, e.name,
           COUNT(DISTINCT w.id) AS sessionCount,
           MAX(w.performed_on) AS lastPerformedOn,
           MAX(s.weight_kg) AS topWeightKg
    FROM exercises e
    JOIN workout_exercises we ON we.exercise_id = e.id
    JOIN workouts w ON w.id = we.workout_id
    JOIN workout_sets s ON s.workout_exercise_id = we.id
    GROUP BY e.id
    ORDER BY lastPerformedOn DESC, e.name
  `);
}

// Every set ever logged for an exercise, oldest first.
export async function getExerciseHistory(db: SQLiteDatabase, exerciseId: number): Promise<SessionRow[]> {
  return db.getAllAsync<SessionRow>(
    `SELECT w.id AS workoutId, w.performed_on AS performedOn, s.weight_kg AS weightKg, s.reps
     FROM workout_sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ?
     ORDER BY w.started_at, s.set_number`,
    exerciseId,
  );
}
