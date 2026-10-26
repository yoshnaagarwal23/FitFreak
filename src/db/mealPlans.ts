import { parseMealPlan, type MealPlan } from '@/lib/mealPlan';
import type { Meal } from '@/lib/macros';

import { must, type Db } from './client';
import { foodLogRow } from './foodLogs';
import { getFoodsById } from './foods';
import { getUserSettings, updateUserSettings } from './settings';

type Stored = { dateKey: string; raw: unknown; logged: Meal[] };

// The last plan is kept (as the raw server JSON) so it survives leaving the screen.
export async function saveLastPlan(db: Db, dateKey: string, raw: unknown, logged: Meal[] = []) {
  await updateUserSettings(db, { last_meal_plan: { dateKey, raw, logged } satisfies Stored });
}

// Re-validated on load; anything malformed is treated as no plan.
export async function getLastPlan(
  db: Db,
  knownFoodIds: Set<number>,
): Promise<{ dateKey: string; raw: unknown; plan: MealPlan; logged: Meal[] } | null> {
  const stored = (await getUserSettings(db))?.last_meal_plan as Stored | null | undefined;
  if (!stored || typeof stored !== 'object') return null;
  const parsed = parseMealPlan(stored.raw, knownFoodIds);
  return parsed.ok ? { ...stored, plan: parsed.value, logged: stored.logged ?? [] } : null;
}

// Logs a planned meal using the app's own food data (not the numbers sent over the network).
// Returns how many items were logged; items whose food was since deleted are skipped.
export async function logPlannedMeal(
  db: Db,
  items: { foodId: number; grams: number }[],
  meal: Meal,
): Promise<number> {
  const foods = await getFoodsById(db, items.map((i) => i.foodId));
  const at = new Date();
  const rows = items.flatMap((i) => {
    const food = foods.get(i.foodId);
    return food ? [foodLogRow(food, i.grams, meal, at)] : [];
  });
  if (rows.length > 0) must(await db.from('food_logs').insert(rows));
  return rows.length;
}
