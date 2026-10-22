import assert from 'node:assert/strict';
import { SEED_FOODS } from '@/db/seedFoods';
import { caloriesFromMacros } from '@/lib/macros';
const names = new Set();
let worst = 0;
for (const f of SEED_FOODS) {
  assert.ok(!names.has(f.name.toLowerCase()), 'dup ' + f.name); names.add(f.name.toLowerCase());
  assert.ok(f.protein + f.carbs + f.fat <= 100, f.name + ' macros > 100 g');
  assert.ok(f.servingGrams > 0 && f.calories > 0, f.name);
  const implied = caloriesFromMacros(f);
  const diff = Math.abs(implied - f.calories);
  const rel = diff / f.calories;
  worst = Math.max(worst, rel);
  if (diff > 8 && rel > 0.12) console.log(`CHECK ${f.name}: listed ${f.calories}, macros imply ${implied.toFixed(0)} (${(rel*100).toFixed(0)}%)`);
}
console.log(`${SEED_FOODS.length} foods · ${SEED_FOODS.filter(f => f.vegetarian).length} vegetarian · worst kcal/macro mismatch ${(worst*100).toFixed(1)}%`);
