import { toDateKey } from '@/lib/date';
import type { SetEntry } from '@/lib/workout';

import { must, type Db } from './client';

export type Workout = {
  id: number;
  performedOn: string;
  startedAt: string;
  finishedAt: string | null;
};

type WorkoutRow = { id: number; performed_on: string; started_at: string; finished_at: string | null };

const WORKOUT_COLUMNS = 'id, performed_on, started_at, finished_at';

const toWorkout = (r: WorkoutRow): Workout => ({
  id: r.id,
  performedOn: r.performed_on,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
});

export async function getActiveWorkout(db: Db): Promise<Workout | null> {
  const row: WorkoutRow | null = must(
    await db.from('workouts').select(WORKOUT_COLUMNS).is('finished_at', null).maybeSingle(),
  );
  return row ? toWorkout(row) : null;
}

// Only one workout can be in progress; returns it instead of starting another.
export async function startWorkout(db: Db, at: Date = new Date()): Promise<number> {
  return must(await db.rpc('start_workout', { p_local_date: toDateKey(at) }));
}

// Starts a workout pre-filled with a split day's exercises and their targets.
// If a workout is already in progress, returns that one instead.
export async function startWorkoutFromSplitDay(db: Db, splitDayId: number, at: Date = new Date()): Promise<number> {
  return must(
    await db.rpc('start_workout_from_split_day', { p_split_day_id: splitDayId, p_local_date: toDateKey(at) }),
  );
}

// Finishing a workout with no sets discards it.
export async function finishWorkout(db: Db, workoutId: number) {
  must(await db.rpc('finish_workout', { p_workout_id: workoutId }));
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

type DetailRow = WorkoutRow & {
  split_days: { title: string } | null;
  workout_exercises: {
    id: number;
    exercise_id: number;
    position: number;
    target_sets: number | null;
    target_reps_min: number | null;
    target_reps_max: number | null;
    exercises: { name: string };
    workout_sets: { id: number; set_number: number; reps: number; weight_kg: number }[];
  }[];
};

export async function getWorkoutDetail(db: Db, workoutId: number): Promise<WorkoutDetail | null> {
  const w: DetailRow | null = must(
    await db
      .from('workouts')
      .select(
        `${WORKOUT_COLUMNS}, split_days (title),
         workout_exercises (id, exercise_id, position, target_sets, target_reps_min, target_reps_max,
           exercises (name), workout_sets (id, set_number, reps, weight_kg))`,
      )
      .eq('id', workoutId)
      .maybeSingle(),
  );
  if (!w) return null;

  const exerciseIds = w.workout_exercises.map((we) => we.exercise_id);
  const lastSets: { exercise_id: number; weight_kg: number; reps: number }[] =
    exerciseIds.length === 0
      ? []
      : must(await db.from('last_sets').select('exercise_id, weight_kg, reps').in('exercise_id', exerciseIds));
  const lastByExercise = new Map(lastSets.map((s) => [s.exercise_id, { weightKg: s.weight_kg, reps: s.reps }]));

  const exercises = [...w.workout_exercises]
    .sort((a, b) => a.position - b.position)
    .map((we) => ({
      id: we.id,
      exerciseId: we.exercise_id,
      name: we.exercises.name,
      target:
        we.target_sets !== null && we.target_reps_min !== null && we.target_reps_max !== null
          ? { sets: we.target_sets, repsMin: we.target_reps_min, repsMax: we.target_reps_max }
          : null,
      sets: [...we.workout_sets]
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({ id: s.id, setNumber: s.set_number, reps: s.reps, weightKg: s.weight_kg })),
      lastSet: lastByExercise.get(we.exercise_id) ?? null,
    }));
  return { ...toWorkout(w), splitDayTitle: w.split_days?.title ?? null, exercises };
}

export async function addExerciseToWorkout(db: Db, workoutId: number, exerciseId: number) {
  must(await db.rpc('add_exercise_to_workout', { p_workout_id: workoutId, p_exercise_id: exerciseId }));
}

export async function removeExerciseFromWorkout(db: Db, workoutExerciseId: number) {
  must(await db.from('workout_exercises').delete().eq('id', workoutExerciseId));
}

export async function addSet(db: Db, workoutExerciseId: number, { weightKg, reps }: SetEntry) {
  must(await db.rpc('add_set', { p_workout_exercise_id: workoutExerciseId, p_reps: reps, p_weight_kg: weightKg }));
}

// Deletes a set and renumbers the remaining sets of that exercise 1..n.
export async function deleteSet(db: Db, setId: number) {
  must(await db.rpc('delete_set', { p_set_id: setId }));
}

export type WorkoutSummary = Workout & {
  exerciseCount: number;
  setCount: number;
  volumeKg: number;
};

export async function getRecentWorkouts(db: Db, limit = 20): Promise<WorkoutSummary[]> {
  const rows: (WorkoutRow & { exercise_count: number; set_count: number; volume_kg: number })[] = must(
    await db.from('workout_summaries').select('*').order('started_at', { ascending: false }).limit(limit),
  );
  return rows.map((r) => ({
    ...toWorkout(r),
    exerciseCount: r.exercise_count,
    setCount: r.set_count,
    volumeKg: r.volume_kg,
  }));
}
