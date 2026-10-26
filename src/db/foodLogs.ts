import { toDateKey } from '@/lib/date';
import { macrosForGrams, type Macros, type Meal } from '@/lib/macros';

import { must, type Db } from './client';
import type { Food } from './foods';

export type FoodLog = Macros & {
  id: number;
  meal: Meal;
  foodName: string;
  grams: number;
  loggedAt: string;
};

// The row for one portion, with macros copied from the food so later edits never change it.
export function foodLogRow(food: Food, grams: number, meal: Meal, at: Date = new Date()) {
  const m = macrosForGrams(food.per100g, grams);
  return {
    logged_on: toDateKey(at),
    logged_at: at.toISOString(),
    meal,
    food_id: food.id,
    food_name: food.name,
    grams,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
  };
}

export async function logFood(db: Db, food: Food, grams: number, meal: Meal, at: Date = new Date()) {
  must(await db.from('food_logs').insert(foodLogRow(food, grams, meal, at)));
}

export async function getFoodLogs(db: Db, dateKey: string): Promise<FoodLog[]> {
  const rows: (Macros & { id: number; meal: Meal; food_name: string; grams: number; logged_at: string })[] =
    must(
      await db
        .from('food_logs')
        .select('id, meal, food_name, grams, logged_at, calories, protein, carbs, fat')
        .eq('logged_on', dateKey)
        .order('logged_at')
        .order('id'),
    );
  return rows.map(({ food_name, logged_at, ...r }) => ({ ...r, foodName: food_name, loggedAt: logged_at }));
}

export async function deleteFoodLog(db: Db, id: number) {
  must(await db.from('food_logs').delete().eq('id', id));
}
