import type { SQLiteDatabase } from 'expo-sqlite';

import type { CustomFoodInput, Macros } from '@/lib/macros';

export type Food = {
  id: number;
  name: string;
  servingLabel: string;
  servingGrams: number;
  per100g: Macros;
  vegetarian: boolean;
  source: string;
};

type FoodRow = {
  id: number;
  name: string;
  serving_label: string;
  serving_grams: number;
  calories_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  is_vegetarian: number;
  source: string;
};

const toFood = (r: FoodRow): Food => ({
  id: r.id,
  name: r.name,
  servingLabel: r.serving_label,
  servingGrams: r.serving_grams,
  per100g: {
    calories: r.calories_100g,
    protein: r.protein_100g,
    carbs: r.carbs_100g,
    fat: r.fat_100g,
  },
  vegetarian: r.is_vegetarian === 1,
  source: r.source,
});

// Name search; names that start with the query rank first.
export async function searchFoods(db: SQLiteDatabase, query: string, limit = 50): Promise<Food[]> {
  const q = query.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await db.getAllAsync<FoodRow>(
    `SELECT * FROM foods WHERE name LIKE ? ESCAPE '\\'
     ORDER BY CASE WHEN name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, name
     LIMIT ?`,
    `%${q}%`,
    `${q}%`,
    limit,
  );
  return rows.map(toFood);
}

export async function getFood(db: SQLiteDatabase, id: number): Promise<Food | null> {
  const row = await db.getFirstAsync<FoodRow>('SELECT * FROM foods WHERE id = ?', id);
  return row ? toFood(row) : null;
}

// Returns null if a food with that name already exists.
export async function createFood(db: SQLiteDatabase, food: CustomFoodInput): Promise<number | null> {
  const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM foods WHERE name = ?', food.name);
  if (existing) return null;
  const result = await db.runAsync(
    `INSERT INTO foods (name, serving_label, serving_grams, calories_100g, protein_100g,
                        carbs_100g, fat_100g, is_vegetarian, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'custom')`,
    food.name,
    food.servingLabel,
    food.servingGrams,
    food.per100g.calories,
    food.per100g.protein,
    food.per100g.carbs,
    food.per100g.fat,
  );
  return result.lastInsertRowId;
}

export async function getAllFoods(db: SQLiteDatabase): Promise<Food[]> {
  const rows = await db.getAllAsync<FoodRow>('SELECT * FROM foods ORDER BY name');
  return rows.map(toFood);
}
