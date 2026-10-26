import type { CustomFoodInput, Macros } from '@/lib/macros';

import { escapeLike, must, type Db } from './client';

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
  is_vegetarian: boolean;
  source: string;
};

const FOOD_COLUMNS =
  'id, name, serving_label, serving_grams, calories_100g, protein_100g, carbs_100g, fat_100g, is_vegetarian, source';

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
  vegetarian: r.is_vegetarian,
  source: r.source,
});

// Name search; names that start with the query rank first.
export async function searchFoods(db: Db, query: string, limit = 50): Promise<Food[]> {
  const q = query.trim();
  const rows: FoodRow[] = must(
    await db.from('foods').select(FOOD_COLUMNS).ilike('name', `%${escapeLike(q)}%`).order('name'),
  );
  const starts = (f: FoodRow) => f.name.toLowerCase().startsWith(q.toLowerCase());
  return [...rows.filter(starts), ...rows.filter((f) => !starts(f))].slice(0, limit).map(toFood);
}

export async function getFood(db: Db, id: number): Promise<Food | null> {
  const row: FoodRow | null = must(await db.from('foods').select(FOOD_COLUMNS).eq('id', id).maybeSingle());
  return row ? toFood(row) : null;
}

export async function getFoodsById(db: Db, ids: number[]): Promise<Map<number, Food>> {
  const rows: FoodRow[] = must(await db.from('foods').select(FOOD_COLUMNS).in('id', ids));
  return new Map(rows.map((r) => [r.id, toFood(r)]));
}

// Returns null if a food with that name already exists (built-in or the user's own).
export async function createFood(db: Db, food: CustomFoodInput): Promise<number | null> {
  const existing: { id: number }[] = must(
    await db.from('foods').select('id').ilike('name', escapeLike(food.name.trim())).limit(1),
  );
  if (existing.length > 0) return null;
  const row: { id: number } = must(
    await db
      .from('foods')
      .insert({
        name: food.name.trim(),
        serving_label: food.servingLabel,
        serving_grams: food.servingGrams,
        calories_100g: food.per100g.calories,
        protein_100g: food.per100g.protein,
        carbs_100g: food.per100g.carbs,
        fat_100g: food.per100g.fat,
        is_vegetarian: true,
        source: 'custom',
      })
      .select('id')
      .single(),
  );
  return row.id;
}

export async function getAllFoods(db: Db): Promise<Food[]> {
  const rows: FoodRow[] = must(await db.from('foods').select(FOOD_COLUMNS).order('name'));
  return rows.map(toFood);
}
