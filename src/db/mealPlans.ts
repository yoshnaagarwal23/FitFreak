import type { SQLiteDatabase } from 'expo-sqlite';

import { parseMealPlan, type MealPlan } from '@/lib/mealPlan';
import type { Meal } from '@/lib/macros';

import { logFood } from './foodLogs';
import { getFood } from './foods';
import { getSetting, setSetting } from './settings';

const KEY = 'last_meal_plan';

type Stored = { dateKey: string; raw: unknown; logged: Meal[] };

// The last plan is kept (as the raw server JSON) so it survives leaving the screen.
export async function saveLastPlan(db: SQLiteDatabase, dateKey: string, raw: unknown, logged: Meal[] = []) {
  await setSetting(db, KEY, JSON.stringify({ dateKey, raw, logged } satisfies Stored));
}

// Re-validated on load; anything malformed is treated as no plan.
export async function getLastPlan(
  db: SQLiteDatabase,
  knownFoodIds: Set<number>,
): Promise<{ dateKey: string; raw: unknown; plan: MealPlan; logged: Meal[] } | null> {
  const text = await getSetting(db, KEY);
  if (!text) return null;
  try {
    const stored = JSON.parse(text) as Stored;
    const parsed = parseMealPlan(stored.raw, knownFoodIds);
    return parsed.ok ? { ...stored, plan: parsed.value, logged: stored.logged ?? [] } : null;
  } catch {
    return null;
  }
}

// Logs a planned meal using the app's own food data (not the numbers sent over the network).
// Returns how many items were logged; items whose food was since deleted are skipped.
export async function logPlannedMeal(
  db: SQLiteDatabase,
  items: { foodId: number; grams: number }[],
  meal: Meal,
): Promise<number> {
  let logged = 0;
  for (const item of items) {
    const food = await getFood(db, item.foodId);
    if (!food) continue;
    await logFood(db, food, item.grams, meal);
    logged++;
  }
  return logged;
}
