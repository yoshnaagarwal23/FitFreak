import type { SQLiteDatabase } from 'expo-sqlite';

import { toDateKey } from '@/lib/date';
import { macrosForGrams, type Macros, type Meal } from '@/lib/macros';

import type { Food } from './foods';

export type FoodLog = Macros & {
  id: number;
  meal: Meal;
  foodName: string;
  grams: number;
  loggedAt: string;
};

export async function logFood(
  db: SQLiteDatabase,
  food: Food,
  grams: number,
  meal: Meal,
  at: Date = new Date(),
) {
  const m = macrosForGrams(food.per100g, grams);
  await db.runAsync(
    `INSERT INTO food_logs (logged_on, logged_at, meal, food_id, food_name, grams,
                            calories, protein, carbs, fat)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    toDateKey(at),
    at.toISOString(),
    meal,
    food.id,
    food.name,
    grams,
    m.calories,
    m.protein,
    m.carbs,
    m.fat,
  );
}

export async function getFoodLogs(db: SQLiteDatabase, dateKey: string): Promise<FoodLog[]> {
  return db.getAllAsync<FoodLog>(
    `SELECT id, meal, food_name AS foodName, grams, logged_at AS loggedAt,
            calories, protein, carbs, fat
     FROM food_logs WHERE logged_on = ? ORDER BY logged_at, id`,
    dateKey,
  );
}

export async function deleteFoodLog(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM food_logs WHERE id = ?', id);
}
