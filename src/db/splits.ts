import { DEFAULT_INPUTS, type SplitInputs, type SplitPlan, type Target } from '@/lib/split';

import { must, type Db } from './client';

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

type ExerciseRow = {
  id: number;
  exercise_id: number;
  position: number;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_sec: number;
  exercises: { name: string };
};

type DayRow = { id: number; weekday: number; day_index: number; title: string; split_day_exercises: ExerciseRow[] };

const DAY_COLUMNS = `id, weekday, day_index, title,
  split_day_exercises (id, exercise_id, position, sets, reps_min, reps_max, rest_sec, exercises (name))`;

const toDay = (d: DayRow): SavedSplitDay => ({
  id: d.id,
  weekday: d.weekday,
  title: d.title,
  exercises: [...d.split_day_exercises]
    .sort((a, b) => a.position - b.position)
    .map((e) => ({
      id: e.id,
      exerciseId: e.exercise_id,
      name: e.exercises.name,
      sets: e.sets,
      repsMin: e.reps_min,
      repsMax: e.reps_max,
      restSec: e.rest_sec,
    })),
});

// Saves a generated plan and makes it the active one. Older plans are kept (inactive)
// because past workouts reference their days.
export async function saveSplit(db: Db, inputs: SplitInputs, plan: SplitPlan): Promise<number> {
  return must(
    await db.rpc('save_split', {
      p_name: plan.name,
      p_inputs: inputs,
      p_days: plan.days.map((d) => ({
        weekday: d.weekday,
        title: d.title,
        exercises: d.exercises.map((e) => ({
          name: e.name,
          sets: e.sets,
          reps_min: e.repsMin,
          reps_max: e.repsMax,
          rest_sec: e.restSec,
        })),
      })),
    }),
  );
}

export async function getActiveSplit(db: Db): Promise<SavedSplit | null> {
  const plan: { id: number; name: string; inputs: Partial<SplitInputs>; split_days: DayRow[] } | null = must(
    await db
      .from('split_plans')
      .select(`id, name, inputs, split_days (${DAY_COLUMNS})`)
      .eq('is_active', true)
      .maybeSingle(),
  );
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    inputs: { ...DEFAULT_INPUTS, ...plan.inputs },
    days: [...plan.split_days].sort((a, b) => a.weekday - b.weekday || a.day_index - b.day_index).map(toDay),
  };
}

// ---- Manual editing ----

export type SplitDayDetail = SavedSplitDay & { planId: number };

export async function getSplitDay(db: Db, splitDayId: number): Promise<SplitDayDetail | null> {
  const day: (DayRow & { plan_id: number }) | null = must(
    await db.from('split_days').select(`plan_id, ${DAY_COLUMNS}`).eq('id', splitDayId).maybeSingle(),
  );
  return day ? { ...toDay(day), planId: day.plan_id } : null;
}

export async function updateSplitDay(db: Db, splitDayId: number, changes: { title?: string; weekday?: number }) {
  must(await db.from('split_days').update(changes).eq('id', splitDayId));
}

export async function addSplitDay(db: Db, planId: number, weekday: number): Promise<number> {
  return must(await db.rpc('add_split_day', { p_plan_id: planId, p_weekday: weekday }));
}

// Past workouts keep their sets and targets; their split_day_id becomes NULL.
export async function deleteSplitDay(db: Db, splitDayId: number) {
  must(await db.from('split_days').delete().eq('id', splitDayId));
}

// Adds with the default targets (DEFAULT_MANUAL_TARGET, applied by the database);
// no-op if the exercise is already on that day.
export async function addExerciseToSplitDay(db: Db, splitDayId: number, exerciseId: number) {
  must(await db.rpc('add_exercise_to_split_day', { p_split_day_id: splitDayId, p_exercise_id: exerciseId }));
}

export async function removeSplitExercise(db: Db, rowId: number) {
  must(await db.from('split_day_exercises').delete().eq('id', rowId));
}

export async function updateSplitExerciseTarget(db: Db, rowId: number, target: Target) {
  must(
    await db
      .from('split_day_exercises')
      .update({ sets: target.sets, reps_min: target.repsMin, reps_max: target.repsMax })
      .eq('id', rowId),
  );
}

// Swaps an exercise with its neighbour (direction -1 = up, +1 = down).
export async function moveSplitExercise(db: Db, rowId: number, direction: -1 | 1) {
  must(await db.rpc('move_split_exercise', { p_row_id: rowId, p_direction: direction }));
}
