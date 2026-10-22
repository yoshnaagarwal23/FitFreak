import assert from 'node:assert/strict';
import { parseMealPlan, buildPlanRequest, remainingTargets, defaultMeals, formatDeviation } from '@/lib/mealPlan';

const m = (c: number) => ({ calories: c, protein: 10, carbs: 20, fat: 5 });
const good = {
  meals: [{ meal: 'lunch', name: 'Dal roti', instructions: 'Cook.', items: [{ food_id: 1, food_name: 'Roti', grams: 80, macros: m(240) }], totals: m(240) }],
  totals: m(240), targets: m(250), deviation: { calories: -0.04, protein: 0, carbs: -0.1, fat: 0.2 },
  within_tolerance: true, notes: 'ok', attempts: 1,
};
const ids = new Set([1, 2]);
const r = parseMealPlan(good, ids);
assert.ok(r.ok); assert.equal(r.value.meals[0].items[0].foodId, 1); assert.equal(r.value.withinTolerance, true);
assert.equal(r.value.deviation.calories, -0.04, 'negative deviation allowed');

const bad = (mut: (g: any) => void, expect: RegExp) => {
  const g = structuredClone(good); mut(g);
  const res = parseMealPlan(g, ids);
  assert.ok(!res.ok, 'should reject'); assert.match(res.error, expect);
};
bad(g => { g.meals[0].items[0].food_id = 99; }, /food 99 isn't in your food list/);
bad(g => { g.meals[0].meal = 'brunch'; }, /not a meal/);
bad(g => { g.meals[0].items = []; }, /no items/);
bad(g => { g.meals = []; }, /no meals/);
bad(g => { g.totals.calories = -5; }, /below 0/);
bad(g => { g.totals.protein = 'lots'; }, /not a number/);
bad(g => { g.meals[0].items[0].macros.fat = NaN; }, /not a number/);
bad(g => { delete g.within_tolerance; }, /within_tolerance/);
bad(g => { g.meals = 'x'; }, /not a list/);
for (const junk of [null, 'html', 42, []]) assert.ok(!parseMealPlan(junk, ids).ok);
const long = structuredClone(good); long.meals[0].name = 'x'.repeat(500);
assert.equal((parseMealPlan(long, ids) as any).value.meals[0].name.length, 120, 'long text truncated');
console.log('parseMealPlan: accepts valid, rejects 13 malformed shapes: OK');

assert.deepEqual(remainingTargets({ calories: 2000, protein: 100, carbs: 250, fat: 60 }, { calories: 2100, protein: 40.4, carbs: 100, fat: 20 }),
  { calories: 0, protein: 60, carbs: 150, fat: 40 });
assert.deepEqual(defaultMeals('day', ['breakfast']), ['breakfast', 'lunch', 'dinner']);
assert.deepEqual(defaultMeals('remaining', ['breakfast', 'snack']), ['lunch', 'dinner']);
assert.equal(formatDeviation(0.054), '+5%'); assert.equal(formatDeviation(-0.12), '−12%'); assert.equal(formatDeviation(0.002), 'on target');
const req = buildPlanRequest({ targets: m(500), foods: [{ id: 1, name: 'Roti', servingLabel: '1 roti', servingGrams: 40, per100g: m(300), vegetarian: true, source: 'usda' }],
  meals: ['dinner', 'breakfast'], vegetarian: true, notes: '  ' + 'n'.repeat(400) });
assert.deepEqual(req.meals, ['breakfast', 'dinner'], 'meals in day order');
assert.equal(req.notes.length, 300); assert.deepEqual(Object.keys(req.foods[0]), ['id', 'name', 'serving_label', 'serving_grams', 'per_100g', 'vegetarian']);
console.log('remainingTargets / defaultMeals / formatDeviation / buildPlanRequest: OK');
console.log('ALL MEAL PLAN CHECKS PASSED');
