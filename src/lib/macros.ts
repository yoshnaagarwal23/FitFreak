// Pure macro math: target calculation, portion scaling, totals, validation.
// No storage or UI here.

import { formatMass, ftInToCm, cmToFtIn, kgToLb, lbToKg, ozToG, type UnitSystem } from './units';

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'very';
export type BodyGoal = 'lose' | 'maintain' | 'gain';
export type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export type Macros = { calories: number; protein: number; carbs: number; fat: number };

export type Profile = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: BodyGoal;
};

export type ManualMacros = { protein: number; carbs: number; fat: number };

export type MacroSettings = {
  mode: 'auto' | 'manual';
  profile: Profile | null;
  manual: ManualMacros | null;
};

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

// Standard activity multipliers for total daily energy. Descriptions cover the whole day,
// not just workouts — people tend to overrate their activity, so the app defaults to Light.
export const ACTIVITY_OPTIONS: { value: Activity; label: string; factor: number; description: string }[] = [
  { value: 'sedentary', label: 'Sedentary', factor: 1.2, description: 'Desk job, little walking, no regular exercise.' },
  { value: 'light', label: 'Light', factor: 1.375, description: 'Desk job, plus exercise 1–3 days a week or some daily walking.' },
  { value: 'moderate', label: 'Moderate', factor: 1.55, description: 'Exercise 3–5 days a week, or on your feet most of the day.' },
  { value: 'very', label: 'Very active', factor: 1.725, description: 'Hard exercise 6–7 days a week, or a physical job.' },
];

export const BODY_GOAL_OPTIONS: { value: BodyGoal; label: string; calorieFactor: number; proteinPerKg: number }[] = [
  { value: 'lose', label: 'Lose fat', calorieFactor: 0.8, proteinPerKg: 2.0 },
  { value: 'maintain', label: 'Maintain', calorieFactor: 1.0, proteinPerKg: 1.6 },
  { value: 'gain', label: 'Build muscle', calorieFactor: 1.1, proteinPerKg: 1.8 },
];

export const DEFAULT_ACTIVITY: Activity = 'light';

export const MEAL_OPTIONS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'snack', label: 'Snack' },
  { value: 'dinner', label: 'Dinner' },
];

const FAT_SHARE = 0.25;
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

// Atwater factors: energy implied by the macros.
export function caloriesFromMacros({ protein, carbs, fat }: ManualMacros): number {
  return protein * KCAL_PER_G.protein + carbs * KCAL_PER_G.carbs + fat * KCAL_PER_G.fat;
}

// Mifflin-St Jeor resting energy.
export function bmr({ sex, age, heightCm, weightKg }: Profile): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export type TargetResult = { targets: Macros; steps: string[] };

// Body stats → daily targets, with each step explained.
export function calculateTargets(profile: Profile, units: UnitSystem = 'metric'): TargetResult {
  const activity = ACTIVITY_OPTIONS.find((a) => a.value === profile.activity) ?? ACTIVITY_OPTIONS[0];
  const goal = BODY_GOAL_OPTIONS.find((g) => g.value === profile.goal) ?? BODY_GOAL_OPTIONS[1];

  const rest = bmr(profile);
  const tdee = rest * activity.factor;
  const calories = Math.round((tdee * goal.calorieFactor) / 10) * 10;
  const protein = Math.round(goal.proteinPerKg * profile.weightKg);
  const fat = Math.round((calories * FAT_SHARE) / KCAL_PER_G.fat);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  const pct = Math.round((goal.calorieFactor - 1) * 100);
  return {
    targets: { calories, protein, carbs, fat },
    steps: [
      `Resting burn (Mifflin-St Jeor): ${Math.round(rest)} kcal`,
      `× ${activity.factor} for ${activity.label.toLowerCase()} activity = ${Math.round(tdee)} kcal maintenance`,
      pct === 0 ? 'Maintain: no adjustment' : `${goal.label}: ${pct > 0 ? '+' : ''}${pct}% → ${calories} kcal`,
      `Protein: ${goal.proteinPerKg} g/kg × ${formatMass(profile.weightKg, 'metric')}${
        units === 'imperial' ? ` (${formatMass(profile.weightKg, 'imperial')})` : ''
      } = ${protein} g`,
      `Fat: ${FAT_SHARE * 100}% of calories = ${fat} g`,
      `Carbs: the remaining calories = ${carbs} g`,
    ],
  };
}

export function manualTargets(m: ManualMacros): Macros {
  return { ...m, calories: Math.round(caloriesFromMacros(m)) };
}

export function resolveTargets(settings: MacroSettings | null): Macros | null {
  if (!settings) return null;
  if (settings.mode === 'manual') return settings.manual ? manualTargets(settings.manual) : null;
  return settings.profile ? calculateTargets(settings.profile).targets : null;
}

// ---- Validation of form text ----

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function parseNumber(text: string, label: string, min: number, max: number): Parsed<number> {
  const n = Number(text.trim().replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(n) || n < min || n > max) {
    return { ok: false, error: `${label} must be between ${min} and ${max}` };
  }
  return { ok: true, value: n };
}

export function parseProfile(
  draft: { age: string; heightCm: string; weightKg: string },
  rest: Pick<Profile, 'sex' | 'activity' | 'goal'>,
): Parsed<Profile> {
  const age = parseNumber(draft.age, 'Age', 13, 100);
  if (!age.ok) return age;
  const height = parseNumber(draft.heightCm, 'Height (cm)', 100, 250);
  if (!height.ok) return height;
  const weight = parseNumber(draft.weightKg, 'Weight (kg)', 30, 300);
  if (!weight.ok) return weight;
  return {
    ok: true,
    value: { ...rest, age: Math.round(age.value), heightCm: height.value, weightKg: weight.value },
  };
}

// Body-stat form text in either unit system. Both sets of fields are kept so switching
// units mid-form doesn't lose what was typed.
export type BodyDraft = {
  age: string;
  heightCm: string;
  weightKg: string;
  heightFt: string;
  heightIn: string;
  weightLb: string;
};

export const EMPTY_BODY_DRAFT: BodyDraft = { age: '', heightCm: '', weightKg: '', heightFt: '', heightIn: '', weightLb: '' };

export function parseBodyDraft(
  draft: BodyDraft,
  units: UnitSystem,
  rest: Pick<Profile, 'sex' | 'activity' | 'goal'>,
): Parsed<Profile> {
  if (units === 'metric') return parseProfile(draft, rest);
  const age = parseNumber(draft.age, 'Age', 13, 100);
  if (!age.ok) return age;
  const ft = parseNumber(draft.heightFt, 'Height (ft)', 3, 8);
  if (!ft.ok) return ft;
  const inches = draft.heightIn.trim() === '' ? { ok: true as const, value: 0 } : parseNumber(draft.heightIn, 'Inches', 0, 11.9);
  if (!inches.ok) return inches;
  const cm = ftInToCm(ft.value, inches.value);
  if (cm < 100 || cm > 250) return { ok: false, error: 'Height must be between 3′ 4″ and 8′ 2″' };
  const lb = parseNumber(draft.weightLb, 'Weight (lb)', 66, 660);
  if (!lb.ok) return lb;
  return {
    ok: true,
    value: {
      ...rest,
      age: Math.round(age.value),
      heightCm: Math.round(cm * 10) / 10,
      weightKg: Math.round(lbToKg(lb.value) * 100) / 100,
    },
  };
}

// Fills both unit systems' fields from a saved (metric) profile.
export function bodyDraftFrom(p: Pick<Profile, 'age' | 'heightCm' | 'weightKg'>): BodyDraft {
  const { ft, in: inches } = cmToFtIn(p.heightCm);
  return {
    age: String(p.age),
    heightCm: String(p.heightCm),
    weightKg: String(p.weightKg),
    heightFt: String(ft),
    heightIn: String(inches),
    weightLb: String(Math.round(kgToLb(p.weightKg) * 10) / 10),
  };
}

export function parseManualMacros(draft: { protein: string; carbs: string; fat: string }): Parsed<ManualMacros> {
  const protein = parseNumber(draft.protein, 'Protein (g)', 0, 500);
  if (!protein.ok) return protein;
  const carbs = parseNumber(draft.carbs, 'Carbs (g)', 0, 1000);
  if (!carbs.ok) return carbs;
  const fat = parseNumber(draft.fat, 'Fat (g)', 0, 400);
  if (!fat.ok) return fat;
  if (protein.value + carbs.value + fat.value === 0) return { ok: false, error: 'Enter at least one macro' };
  return { ok: true, value: { protein: protein.value, carbs: carbs.value, fat: fat.value } };
}

// ---- Foods and portions ----

export type FoodNutrition = { per100g: Macros; servingGrams: number };
export type PortionUnit = 'serving' | 'grams' | 'ounces';

export const MAX_PORTION_GRAMS = 5000;

export function macrosForGrams(per100g: Macros, grams: number): Macros {
  const f = grams / 100;
  return {
    calories: per100g.calories * f,
    protein: per100g.protein * f,
    carbs: per100g.carbs * f,
    fat: per100g.fat * f,
  };
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (t, m) => ({
      calories: t.calories + m.calories,
      protein: t.protein + m.protein,
      carbs: t.carbs + m.carbs,
      fat: t.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// Amount text in servings, grams, or ounces → grams.
export function parsePortion(text: string, unit: PortionUnit, servingGrams: number): Parsed<number> {
  const n = Number(text.trim().replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(n) || n <= 0) {
    return { ok: false, error: 'Enter an amount above 0' };
  }
  const grams = unit === 'serving' ? n * servingGrams : unit === 'ounces' ? ozToG(n) : n;
  if (grams > MAX_PORTION_GRAMS) {
    return { ok: false, error: `That's over ${unit === 'ounces' ? '176 oz' : `${MAX_PORTION_GRAMS / 1000} kg`}` };
  }
  return { ok: true, value: Math.round(grams * 10) / 10 };
}

export type CustomFoodInput = {
  name: string;
  servingLabel: string;
  servingGrams: number;
  per100g: Macros;
};

// Custom food from a nutrition label (values per 100 g). Calories derive from the macros.
export function parseCustomFood(draft: {
  name: string;
  servingLabel: string;
  servingGrams: string;
  protein: string;
  carbs: string;
  fat: string;
}): Parsed<CustomFoodInput> {
  const name = draft.name.trim();
  if (name.length < 2) return { ok: false, error: 'Give the food a name' };
  const serving = parseNumber(draft.servingGrams, 'Serving size (g)', 1, 2000);
  if (!serving.ok) return serving;
  const protein = parseNumber(draft.protein, 'Protein per 100 g', 0, 100);
  if (!protein.ok) return protein;
  const carbs = parseNumber(draft.carbs, 'Carbs per 100 g', 0, 100);
  if (!carbs.ok) return carbs;
  const fat = parseNumber(draft.fat, 'Fat per 100 g', 0, 100);
  if (!fat.ok) return fat;
  if (protein.value + carbs.value + fat.value > 100) {
    return { ok: false, error: 'Protein + carbs + fat can’t exceed 100 g per 100 g' };
  }
  const macros = { protein: protein.value, carbs: carbs.value, fat: fat.value };
  return {
    ok: true,
    value: {
      name,
      servingLabel: draft.servingLabel.trim() || '1 serving',
      servingGrams: serving.value,
      per100g: { ...macros, calories: Math.round(caloriesFromMacros(macros)) },
    },
  };
}

// Suggests a meal from the time of day.
export function defaultMeal(at: Date = new Date()): Meal {
  const h = at.getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 19) return 'snack';
  return 'dinner';
}

export function formatKcal(kcal: number): string {
  return `${Math.round(kcal)} kcal`;
}
