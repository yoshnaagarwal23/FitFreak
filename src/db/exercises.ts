import type { Equipment, MuscleGroup, SessionRow } from '@/lib/workout';

import { escapeLike, must, type Db } from './client';

export type Exercise = {
  id: number;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  isCustom: boolean;
};

type ExerciseRow = {
  id: number;
  user_id: string | null;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
};

// Built-in exercises have no owner; custom ones belong to the user who added them.
const toExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  name: r.name,
  muscleGroup: r.muscle_group,
  equipment: r.equipment,
  isCustom: r.user_id !== null,
});

const EXERCISE_COLUMNS = 'id, user_id, name, muscle_group, equipment';

export async function searchExercises(db: Db, query: string): Promise<Exercise[]> {
  const rows: ExerciseRow[] = must(
    await db
      .from('exercises')
      .select(EXERCISE_COLUMNS)
      .ilike('name', `%${escapeLike(query.trim())}%`)
      .order('muscle_group')
      .order('name'),
  );
  return rows.map(toExercise);
}

export async function getExercise(db: Db, id: number): Promise<Exercise | null> {
  const row: ExerciseRow | null = must(
    await db.from('exercises').select(EXERCISE_COLUMNS).eq('id', id).maybeSingle(),
  );
  return row ? toExercise(row) : null;
}

// Returns the existing exercise's id if the name is already taken (case-insensitive).
export async function createExercise(db: Db, name: string): Promise<number> {
  const trimmed = name.trim();
  const existing: { id: number }[] = must(
    await db
      .from('exercises')
      .select('id')
      .ilike('name', escapeLike(trimmed))
      .order('user_id', { nullsFirst: true })
      .limit(1),
  );
  if (existing.length > 0) return existing[0].id;
  const row: { id: number } = must(
    await db
      .from('exercises')
      .insert({ name: trimmed, muscle_group: 'other', equipment: 'other' })
      .select('id')
      .single(),
  );
  return row.id;
}

export type LoggedExercise = {
  id: number;
  name: string;
  sessionCount: number;
  lastPerformedOn: string;
  topWeightKg: number;
};

// Exercises with at least one logged set, most recently trained first.
export async function getLoggedExercises(db: Db): Promise<LoggedExercise[]> {
  const rows: {
    id: number;
    name: string;
    session_count: number;
    last_performed_on: string;
    top_weight_kg: number;
  }[] = must(
    await db
      .from('logged_exercises')
      .select('*')
      .order('last_performed_on', { ascending: false })
      .order('name'),
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sessionCount: r.session_count,
    lastPerformedOn: r.last_performed_on,
    topWeightKg: r.top_weight_kg,
  }));
}

// Every set ever logged for an exercise, oldest first.
export async function getExerciseHistory(db: Db, exerciseId: number): Promise<SessionRow[]> {
  const rows: { workout_id: number; performed_on: string; weight_kg: number; reps: number }[] = must(
    await db
      .from('exercise_sets')
      .select('workout_id, performed_on, weight_kg, reps')
      .eq('exercise_id', exerciseId)
      .order('started_at')
      .order('set_number'),
  );
  return rows.map((r) => ({
    workoutId: r.workout_id,
    performedOn: r.performed_on,
    weightKg: r.weight_kg,
    reps: r.reps,
  }));
}
