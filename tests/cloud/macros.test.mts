import assert from 'node:assert/strict';
import { newUser, sql } from '../support/cloud.mts';
import * as M from '@/lib/macros';
import { toDateKey } from '@/lib/date';
import { searchFoods, createFood, getAllFoods } from '@/db/foods';
import { logFood, getFoodLogs, deleteFoodLog } from '@/db/foodLogs';
import { saveMacroSettings, getMacroSettings } from '@/db/macroSettings';
import { getLastPlan, logPlannedMeal, saveLastPlan } from '@/db/mealPlans';
import { getUserSettings, updateUserSettings } from '@/db/settings';
import { addWater, getGoalGlasses, getTotalMl, removeLatestWater, setGoalGlasses } from '@/db/water';

const { id, db } = newUser();
const other = newUser();

// ---- Foods ----
assert.equal((await getAllFoods(db)).length, 47, 'built-in foods visible');
const dal = await searchFoods(db, 'dal');
assert.ok(dal.length > 0 && dal.every((f) => f.name.toLowerCase().includes('dal')));
assert.ok((await searchFoods(db, 'Ro'))[0].name.startsWith('Ro'), 'prefix matches first');
assert.deepEqual(await searchFoods(db, '%'), [], 'LIKE wildcards escaped');
assert.equal(typeof dal[0].per100g.protein, 'number', 'numeric columns arrive as numbers');
console.log('food search: OK');

const roti = (await searchFoods(db, 'roti'))[0];
await logFood(db, roti, 80, 'lunch', new Date('2026-10-21T13:00:00'));
await logFood(db, roti, 40, 'dinner', new Date('2026-10-20T21:00:00')); // different day
let logs = await getFoodLogs(db, '2026-10-21');
assert.equal(logs.length, 1);
assert.ok(Math.abs(logs[0].calories - 237.6) < 1e-6);
assert.equal(logs[0].meal, 'lunch');
assert.equal(logs[0].foodName, roti.name);
// Snapshot: editing the food does not rewrite the log
sql(`update foods set calories_100g = 999 where name = '${roti.name}'`);
assert.ok(Math.abs((await getFoodLogs(db, '2026-10-21'))[0].calories - 237.6) < 1e-6);
sql(`update foods set calories_100g = ${roti.per100g.calories} where name = '${roti.name}'`);
await deleteFoodLog(db, logs[0].id);
assert.equal((await getFoodLogs(db, '2026-10-21')).length, 0);
assert.equal((await getFoodLogs(other.db, '2026-10-20')).length, 0, 'other users see none of it');
console.log('log / day filter / snapshot / delete / isolation: OK');

const cf = M.parseCustomFood({ name: 'Test curd', servingLabel: '1 cup', servingGrams: '200', protein: '10', carbs: '5', fat: '2' });
assert.ok(cf.ok);
assert.ok(await createFood(db, cf.value));
assert.equal(await createFood(db, { ...cf.value, name: 'TEST CURD' }), null, 'case-insensitive duplicate');
assert.equal(await createFood(db, { ...cf.value, name: 'roti / chapati' }), null, 'cannot shadow a built-in');
assert.equal((await searchFoods(db, 'test curd'))[0].source, 'custom');
assert.equal((await searchFoods(other.db, 'test curd')).length, 0, 'custom foods are private');
assert.ok(await createFood(other.db, cf.value), 'another user may use the same name');
console.log('custom food create + duplicate guard + privacy: OK');

// ---- Settings ----
assert.equal(await getUserSettings(db), null, 'no settings row until first change');
assert.equal(await getMacroSettings(db), null);
const p = { sex: 'female', age: 30, heightCm: 165, weightKg: 60, activity: 'moderate', goal: 'maintain' } as const;
await saveMacroSettings(db, { mode: 'auto', profile: p as any, manual: null });
assert.deepEqual(M.resolveTargets(await getMacroSettings(db)), M.calculateTargets(p).targets);
await updateUserSettings(db, { units: 'imperial' });
assert.equal((await getUserSettings(db))!.units, 'imperial');
assert.ok(await getMacroSettings(db), 'updating one setting keeps the others');
sql(`update user_settings set macro_settings = '{"mode": "bogus"}' where user_id = '${id}'`);
assert.equal(await getMacroSettings(db), null, 'unknown shape → null, no crash');
console.log('settings round-trip, partial update, bad-shape guard: OK');

// ---- Water ----
assert.equal(await getGoalGlasses(db), 8);
await setGoalGlasses(db, 99);
assert.equal(await getGoalGlasses(db), 20, 'clamped');
await addWater(db, 250, new Date('2026-10-21T08:00:00'));
await addWater(db, 250, new Date('2026-10-21T09:00:00'));
await addWater(db, 250, new Date('2026-10-22T09:00:00'));
assert.equal(await getTotalMl(db, '2026-10-21'), 500);
await removeLatestWater(db, '2026-10-21');
assert.equal(await getTotalMl(db, '2026-10-21'), 250);
assert.equal(await getTotalMl(db, '2026-10-22'), 250, 'undo only touches that day');
await removeLatestWater(other.db, '2026-10-22');
assert.equal(await getTotalMl(db, '2026-10-22'), 250, 'another user cannot undo my water');
console.log('water add / total / undo / goal: OK');

// ---- Meal plan storage and logging ----
const paneer = (await searchFoods(db, 'paneer'))[0];
const raw = { meals: [{ meal: 'lunch', name: 'x', items: [{ foodId: paneer.id, grams: 100 }] }] };
await saveLastPlan(db, '2026-10-21', raw, ['breakfast']);
const stored = (await getUserSettings(db))!.last_meal_plan as any;
assert.deepEqual(stored, { dateKey: '2026-10-21', raw, logged: ['breakfast'] });
assert.equal(await getLastPlan(db, new Set([paneer.id])), null, 'malformed plan → null');
const n = await logPlannedMeal(db, [{ foodId: paneer.id, grams: 100 }, { foodId: 999999, grams: 50 }], 'dinner');
assert.equal(n, 1, 'unknown food skipped');
const today = (await getFoodLogs(db, toDateKey())).filter((l) => l.meal === 'dinner');
assert.equal(today.length, 1);
assert.equal(today[0].protein, M.macrosForGrams(paneer.per100g, 100).protein);
console.log('meal plan save / validate / log: OK');
console.log('ALL CLOUD MACRO CHECKS PASSED');
