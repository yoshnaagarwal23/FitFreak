// Meal plan types, request building, and validation of the server's response.
// The response crosses a network boundary, so nothing is displayed until it passes parseMealPlan.

import type { Food } from '@/db/foods';

import { MEAL_OPTIONS, type Macros, type Meal } from './macros';

export type PlanItem = { foodId: number; foodName: string; grams: number; macros: Macros };
export type PlanMeal = { meal: Meal; name: string; instructions: string; items: PlanItem[]; totals: Macros };
export type MealPlan = {
  meals: PlanMeal[];
  totals: Macros;
  targets: Macros;
  deviation: Macros; // (actual - target) / target per macro
  withinTolerance: boolean;
  notes: string;
  attempts: number;
};

export type PlanScope = 'day' | 'remaining';

export const MIN_PLAN_CALORIES = 200;
const MEALS: Meal[] = MEAL_OPTIONS.map((m) => m.value);

// ---- Request ----

export function remainingTargets(targets: Macros, eaten: Macros): Macros {
  return {
    calories: Math.max(0, Math.round(targets.calories - eaten.calories)),
    protein: Math.max(0, Math.round(targets.protein - eaten.protein)),
    carbs: Math.max(0, Math.round(targets.carbs - eaten.carbs)),
    fat: Math.max(0, Math.round(targets.fat - eaten.fat)),
  };
}

// Whole day: the three main meals. What's left: main meals not logged yet today.
export function defaultMeals(scope: PlanScope, loggedMeals: Meal[]): Meal[] {
  const main: Meal[] = ['breakfast', 'lunch', 'dinner'];
  return scope === 'day' ? main : main.filter((m) => !loggedMeals.includes(m));
}

export function buildPlanRequest(input: {
  targets: Macros;
  foods: Food[];
  meals: Meal[];
  vegetarian: boolean;
  notes: string;
}) {
  return {
    targets: input.targets,
    foods: input.foods.map((f) => ({
      id: f.id,
      name: f.name,
      serving_label: f.servingLabel,
      serving_grams: f.servingGrams,
      per_100g: f.per100g,
      vegetarian: f.vegetarian,
    })),
    meals: MEALS.filter((m) => input.meals.includes(m)),
    vegetarian: input.vegetarian,
    notes: input.notes.trim().slice(0, 300),
  };
}

// ---- Response validation ----

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

class Invalid extends Error {}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, path: string, opts: { min?: number } = {}): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Invalid(`${path} is not a number`);
  if (opts.min !== undefined && v < opts.min) throw new Invalid(`${path} is below ${opts.min}`);
  return v;
}

function str(v: unknown, path: string, max = 1000): string {
  if (typeof v !== 'string') throw new Invalid(`${path} is not text`);
  return v.slice(0, max);
}

function obj(v: unknown, path: string): Record<string, unknown> {
  if (!isObject(v)) throw new Invalid(`${path} is missing`);
  return v;
}

function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw new Invalid(`${path} is not a list`);
  return v;
}

function macros(v: unknown, path: string, allowNegative = false): Macros {
  const o = obj(v, path);
  const min = allowNegative ? undefined : 0;
  return {
    calories: num(o.calories, `${path}.calories`, { min }),
    protein: num(o.protein, `${path}.protein`, { min }),
    carbs: num(o.carbs, `${path}.carbs`, { min }),
    fat: num(o.fat, `${path}.fat`, { min }),
  };
}

function meal(v: unknown, path: string): Meal {
  if (!MEALS.includes(v as Meal)) throw new Invalid(`${path} is not a meal`);
  return v as Meal;
}

export function parseMealPlan(json: unknown, knownFoodIds: Set<number>): Parsed<MealPlan> {
  try {
    const o = obj(json, 'plan');
    const meals = arr(o.meals, 'meals').map((m, i): PlanMeal => {
      const mo = obj(m, `meals[${i}]`);
      const items = arr(mo.items, `meals[${i}].items`).map((it, j): PlanItem => {
        const io = obj(it, `meals[${i}].items[${j}]`);
        const foodId = num(io.food_id, `meals[${i}].items[${j}].food_id`);
        if (!knownFoodIds.has(foodId)) throw new Invalid(`food ${foodId} isn't in your food list`);
        return {
          foodId,
          foodName: str(io.food_name, 'food_name', 120),
          grams: num(io.grams, 'grams', { min: 0 }),
          macros: macros(io.macros, `meals[${i}].items[${j}].macros`),
        };
      });
      if (items.length === 0) throw new Invalid(`meals[${i}] has no items`);
      return {
        meal: meal(mo.meal, `meals[${i}].meal`),
        name: str(mo.name, 'name', 120),
        instructions: str(mo.instructions, 'instructions', 800),
        items,
        totals: macros(mo.totals, `meals[${i}].totals`),
      };
    });
    if (meals.length === 0) throw new Invalid('the plan has no meals');
    if (typeof o.within_tolerance !== 'boolean') throw new Invalid('within_tolerance is missing');
    return {
      ok: true,
      value: {
        meals,
        totals: macros(o.totals, 'totals'),
        targets: macros(o.targets, 'targets'),
        deviation: macros(o.deviation, 'deviation', true),
        withinTolerance: o.within_tolerance,
        notes: str(o.notes, 'notes', 500),
        attempts: num(o.attempts, 'attempts', { min: 1 }),
      },
    };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: `The planner sent an invalid plan (${e.message}).` };
    throw e;
  }
}

// 0.054 → "+5%", -0.12 → "−12%"
export function formatDeviation(d: number): string {
  const pct = Math.round(d * 100);
  if (pct === 0) return 'on target';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}
