// Rule-based weekly split generator. Pure and deterministic: same inputs → same plan.
// No storage, UI, or AI here.

import type { Equipment } from './workout';

export type Goal = 'strength' | 'hypertrophy' | 'fat_loss' | 'general';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type GymEquipment = Exclude<Equipment, 'bodyweight' | 'other'>;

export type SplitInputs = {
  goal: Goal;
  daysPerWeek: number;
  experience: Experience;
  equipment: GymEquipment[]; // bodyweight is always available
};

export const MIN_DAYS = 2;
export const MAX_DAYS = 6;

export const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Muscle' },
  { value: 'fat_loss', label: 'Fat loss' },
  { value: 'general', label: 'General' },
];

export const EXPERIENCE_OPTIONS: { value: Experience; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const EQUIPMENT_OPTIONS: { value: GymEquipment; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbells' },
  { value: 'machine', label: 'Machines' },
  { value: 'cable', label: 'Cables' },
];

export const DEFAULT_INPUTS: SplitInputs = {
  goal: 'hypertrophy',
  daysPerWeek: 4,
  experience: 'beginner',
  equipment: ['barbell', 'dumbbell', 'machine', 'cable'],
};

// ---- Movement patterns and the exercises that can fill them ----

export type Pattern =
  | 'squat' | 'hinge' | 'lunge' | 'leg_iso' | 'calves'
  | 'h_push' | 'v_push' | 'chest_iso'
  | 'h_pull' | 'v_pull' | 'side_delt' | 'rear_delt'
  | 'biceps' | 'triceps' | 'core';

const PATTERN_LABELS: Record<Pattern, string> = {
  squat: 'squat', hinge: 'hip hinge', lunge: 'single-leg', leg_iso: 'leg isolation',
  calves: 'calves', h_push: 'horizontal press', v_push: 'overhead press',
  chest_iso: 'chest isolation', h_pull: 'row', v_pull: 'vertical pull',
  side_delt: 'side delts', rear_delt: 'rear delts', biceps: 'biceps', triceps: 'triceps',
  core: 'core',
};

// Ranked by preference. Names must exist in the exercise library (checked by tests).
export const CATALOG: Record<Pattern, { name: string; equipment: Equipment }[]> = {
  squat: [
    { name: 'Back Squat', equipment: 'barbell' },
    { name: 'Leg Press', equipment: 'machine' },
    { name: 'Goblet Squat', equipment: 'dumbbell' },
    { name: 'Bodyweight Squat', equipment: 'bodyweight' },
  ],
  hinge: [
    { name: 'Deadlift', equipment: 'barbell' },
    { name: 'Romanian Deadlift', equipment: 'barbell' },
    { name: 'Dumbbell Romanian Deadlift', equipment: 'dumbbell' },
    { name: 'Glute Bridge', equipment: 'bodyweight' },
  ],
  lunge: [
    { name: 'Bulgarian Split Squat', equipment: 'dumbbell' },
    { name: 'Walking Lunge', equipment: 'dumbbell' },
    { name: 'Reverse Lunge', equipment: 'bodyweight' },
  ],
  leg_iso: [
    { name: 'Leg Curl', equipment: 'machine' },
    { name: 'Leg Extension', equipment: 'machine' },
    { name: 'Glute Bridge', equipment: 'bodyweight' },
  ],
  calves: [
    { name: 'Calf Raise', equipment: 'machine' },
    { name: 'Single-leg Calf Raise', equipment: 'bodyweight' },
  ],
  h_push: [
    { name: 'Bench Press', equipment: 'barbell' },
    { name: 'Incline Dumbbell Press', equipment: 'dumbbell' },
    { name: 'Chest Press Machine', equipment: 'machine' },
    { name: 'Push-up', equipment: 'bodyweight' },
  ],
  v_push: [
    { name: 'Overhead Press', equipment: 'barbell' },
    { name: 'Dumbbell Shoulder Press', equipment: 'dumbbell' },
    { name: 'Pike Push-up', equipment: 'bodyweight' },
  ],
  chest_iso: [
    { name: 'Cable Fly', equipment: 'cable' },
    { name: 'Dumbbell Fly', equipment: 'dumbbell' },
    { name: 'Push-up', equipment: 'bodyweight' },
  ],
  h_pull: [
    { name: 'Barbell Row', equipment: 'barbell' },
    { name: 'Seated Cable Row', equipment: 'cable' },
    { name: 'Dumbbell Row', equipment: 'dumbbell' },
    { name: 'Inverted Row', equipment: 'bodyweight' },
  ],
  v_pull: [
    { name: 'Lat Pulldown', equipment: 'cable' },
    { name: 'Pull-up', equipment: 'bodyweight' },
    { name: 'Chin-up', equipment: 'bodyweight' },
  ],
  side_delt: [
    { name: 'Lateral Raise', equipment: 'dumbbell' },
    { name: 'Cable Lateral Raise', equipment: 'cable' },
  ],
  rear_delt: [
    { name: 'Face Pull', equipment: 'cable' },
    { name: 'Reverse Dumbbell Fly', equipment: 'dumbbell' },
  ],
  biceps: [
    { name: 'Barbell Curl', equipment: 'barbell' },
    { name: 'Dumbbell Curl', equipment: 'dumbbell' },
    { name: 'Chin-up', equipment: 'bodyweight' },
  ],
  triceps: [
    { name: 'Triceps Pushdown', equipment: 'cable' },
    { name: 'Skull Crusher', equipment: 'barbell' },
    { name: 'Overhead Dumbbell Extension', equipment: 'dumbbell' },
    { name: 'Dips', equipment: 'bodyweight' },
  ],
  core: [
    { name: 'Hanging Leg Raise', equipment: 'bodyweight' },
    { name: 'Cable Crunch', equipment: 'cable' },
  ],
};

// ---- Day templates ----

export type Role = 'compound' | 'accessory';
type DayType = 'full_a' | 'full_b' | 'full_c' | 'push' | 'pull' | 'legs' | 'upper' | 'lower';

const C: Role = 'compound';
const A: Role = 'accessory';

const DAY_TEMPLATES: Record<DayType, { title: string; slots: [Pattern, Role][] }> = {
  full_a: { title: 'Full Body A', slots: [['squat', C], ['h_push', C], ['v_pull', C], ['side_delt', A], ['core', A]] },
  full_b: { title: 'Full Body B', slots: [['hinge', C], ['v_push', C], ['h_pull', C], ['lunge', A], ['biceps', A]] },
  full_c: { title: 'Full Body C', slots: [['squat', C], ['h_push', C], ['h_pull', C], ['rear_delt', A], ['triceps', A]] },
  push: { title: 'Push', slots: [['h_push', C], ['v_push', C], ['chest_iso', A], ['side_delt', A], ['triceps', A]] },
  pull: { title: 'Pull', slots: [['v_pull', C], ['h_pull', C], ['rear_delt', A], ['biceps', A], ['core', A]] },
  legs: { title: 'Legs', slots: [['squat', C], ['hinge', C], ['lunge', A], ['leg_iso', A], ['calves', A]] },
  upper: {
    title: 'Upper',
    slots: [['h_push', C], ['h_pull', C], ['v_push', C], ['v_pull', C], ['biceps', A], ['triceps', A]],
  },
  lower: {
    title: 'Lower',
    slots: [['squat', C], ['hinge', C], ['lunge', A], ['leg_iso', A], ['calves', A], ['core', A]],
  },
};

function chooseTemplate(days: number, experience: Experience): { name: string; dayTypes: DayType[]; why: string } {
  switch (days) {
    case 2:
      return { name: 'Full Body ×2', dayTypes: ['full_a', 'full_b'], why: 'each muscle trained twice a week in two sessions' };
    case 3:
      return experience === 'beginner'
        ? { name: 'Full Body ×3', dayTypes: ['full_a', 'full_b', 'full_c'], why: 'frequent practice of the main lifts, which beginners progress fastest on' }
        : { name: 'Push / Pull / Legs', dayTypes: ['push', 'pull', 'legs'], why: 'more volume per muscle in each session' };
    case 4:
      return { name: 'Upper / Lower', dayTypes: ['upper', 'lower', 'upper', 'lower'], why: 'each muscle trained twice a week with recovery between' };
    case 5:
      return { name: 'PPL + Upper / Lower', dayTypes: ['push', 'pull', 'legs', 'upper', 'lower'], why: 'push/pull/legs plus a second hit for every muscle' };
    default:
      return { name: 'Push / Pull / Legs ×2', dayTypes: ['push', 'pull', 'legs', 'push', 'pull', 'legs'], why: 'each muscle trained twice a week with high volume' };
  }
}

// Training days spread across the week (1 = Mon … 7 = Sun), leaving rest days between where possible.
const WEEKDAYS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

// ---- Prescription: sets × reps × rest ----

type Prescription = { sets: number; repsMin: number; repsMax: number; restSec: number };

const PRESCRIPTIONS: Record<Goal, Record<Role, Prescription>> = {
  strength: {
    compound: { sets: 4, repsMin: 3, repsMax: 5, restSec: 180 },
    accessory: { sets: 3, repsMin: 6, repsMax: 10, restSec: 90 },
  },
  hypertrophy: {
    compound: { sets: 3, repsMin: 6, repsMax: 10, restSec: 120 },
    accessory: { sets: 3, repsMin: 10, repsMax: 15, restSec: 60 },
  },
  fat_loss: {
    compound: { sets: 3, repsMin: 8, repsMax: 12, restSec: 90 },
    accessory: { sets: 2, repsMin: 12, repsMax: 15, restSec: 45 },
  },
  general: {
    compound: { sets: 3, repsMin: 8, repsMax: 12, restSec: 90 },
    accessory: { sets: 2, repsMin: 10, repsMax: 15, restSec: 60 },
  },
};

const GOAL_NOTES: Record<Goal, string> = {
  strength: 'Strength: heavy compound lifts for 3–5 reps with long (3 min) rests.',
  hypertrophy: 'Muscle: 6–10 reps on compounds and 10–15 on accessories — moderate weight, close to failure.',
  fat_loss: 'Fat loss: moderate reps with shorter rests to keep sessions dense. Diet does most of the work.',
  general: 'General fitness: moderate reps and volume that are easy to recover from.',
};

const BEGINNER_MAX_EXERCISES = 5;

function prescribe(goal: Goal, role: Role, experience: Experience): Prescription {
  const base = PRESCRIPTIONS[goal][role];
  let sets = base.sets;
  // Beginners: practice the main lifts (3 sets) but trim accessory volume.
  if (experience === 'beginner') sets = role === 'compound' ? Math.min(3, sets) : Math.max(2, sets - 1);
  if (experience === 'advanced' && role === 'compound') sets += 1;
  return { ...base, sets };
}

// ---- Output ----

export type PlanExercise = Prescription & { name: string; pattern: Pattern; role: Role };
export type PlanDay = { weekday: number; title: string; exercises: PlanExercise[] };
export type SplitPlan = { name: string; days: PlanDay[]; notes: string[] };

export function clampDays(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_INPUTS.daysPerWeek;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(days)));
}

export function generateSplit(inputs: SplitInputs): SplitPlan {
  const days = clampDays(inputs.daysPerWeek);
  const { goal, experience } = inputs;
  const available = new Set<Equipment>([...inputs.equipment, 'bodyweight']);
  const template = chooseTemplate(days, experience);

  const notes: string[] = [`${days} days/week → ${template.name}: ${template.why}.`, GOAL_NOTES[goal]];
  if (experience === 'beginner') {
    notes.push(`Beginner: 3 sets on main lifts, fewer accessory sets, and at most ${BEGINNER_MAX_EXERCISES} exercises a day while you learn the movements.`);
    if (days >= 5) notes.push('Most beginners progress well on 3–4 days; 5+ days needs good sleep and recovery.');
  }
  if (experience === 'advanced') notes.push('Advanced: an extra set on compound lifts for more stimulus.');

  const skipped = new Set<Pattern>();
  const occurrences = new Map<DayType, number>();

  const planDays = template.dayTypes.map((type, i): PlanDay => {
    // The second Upper/Push/etc. of the week picks the next option, for variety.
    const variant = occurrences.get(type) ?? 0;
    occurrences.set(type, variant + 1);

    const { title, slots } = DAY_TEMPLATES[type];
    const used = new Set<string>();
    const exercises: PlanExercise[] = [];

    for (const [pattern, role] of slots) {
      const options = CATALOG[pattern].filter((o) => available.has(o.equipment) && !used.has(o.name));
      if (options.length === 0) {
        skipped.add(pattern);
        continue;
      }
      const pick = options[variant % options.length];
      used.add(pick.name);
      exercises.push({ name: pick.name, pattern, role, ...prescribe(goal, role, experience) });
    }

    const capped = experience === 'beginner' ? exercises.slice(0, BEGINNER_MAX_EXERCISES) : exercises;
    const repeatsTitle = template.dayTypes.filter((t) => t === type).length > 1;
    return {
      weekday: WEEKDAYS[days][i],
      title: repeatsTitle ? `${title} ${variant === 0 ? 'A' : 'B'}` : title,
      exercises: capped,
    };
  });

  if (skipped.size > 0) {
    const labels = [...skipped].map((p) => PATTERN_LABELS[p]).join(', ');
    notes.push(`Skipped (no suitable equipment): ${labels}.`);
  }
  if (!available.has('cable') && !available.has('machine') && !available.has('barbell')) {
    notes.push('Bodyweight pulling assumes access to a pull-up bar.');
  }

  return { name: template.name, days: planDays, notes };
}

export function formatReps({ repsMin, repsMax }: { repsMin: number; repsMax: number }): string {
  return repsMin === repsMax ? `${repsMin}` : `${repsMin}–${repsMax}`;
}

// ---- Manual editing ----

export type Target = { sets: number; repsMin: number; repsMax: number };
export type TargetField = keyof Target;

export const TARGET_LIMITS: Record<TargetField, { min: number; max: number }> = {
  sets: { min: 1, max: 10 },
  repsMin: { min: 1, max: 50 },
  repsMax: { min: 1, max: 50 },
};

// Used when an exercise is added to a split day by hand.
export const DEFAULT_MANUAL_TARGET: Target & { restSec: number } = {
  sets: 3,
  repsMin: 8,
  repsMax: 12,
  restSec: 90,
};

// Steps one field within its limits, keeping repsMin ≤ repsMax by moving the other end.
export function adjustTarget(target: Target, field: TargetField, delta: number): Target {
  const { min, max } = TARGET_LIMITS[field];
  const next = { ...target, [field]: Math.min(max, Math.max(min, target[field] + delta)) };
  if (next.repsMin > next.repsMax) {
    if (field === 'repsMin') next.repsMax = next.repsMin;
    else next.repsMin = next.repsMax;
  }
  return next;
}

// First weekday (Mon → Sun) not already used, or null if all seven are taken.
export function firstFreeWeekday(used: number[]): number | null {
  for (let d = 1; d <= 7; d++) if (!used.includes(d)) return d;
  return null;
}
