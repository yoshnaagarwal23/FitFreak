import assert from 'node:assert/strict';
import { openTestDb } from './support/sqlite.mts';
import * as M from '@/lib/macros';
import { migrate, LATEST_VERSION } from '@/db/migrations';
import { searchFoods, createFood } from '@/db/foods';
import { logFood, getFoodLogs, deleteFoodLog } from '@/db/foodLogs';
import { saveMacroSettings, getMacroSettings } from '@/db/macroSettings';
import { setSetting } from '@/db/settings';

// ---- Pure math ----
const p = { sex: 'female', age: 30, heightCm: 165, weightKg: 60, activity: 'moderate', goal: 'maintain' } as const;
assert.equal(Math.round(M.bmr(p)), 1320);
const r = M.calculateTargets(p);
assert.deepEqual(r.targets, { calories: 2050, protein: 96, carbs: 288, fat: 57 });
assert.equal(r.steps.length, 6);
const lose = M.calculateTargets({ ...p, sex: 'male', weightKg: 80, heightCm: 180, goal: 'lose', activity: 'light' });
// male: 800 + 1125 - 150 + 5 = 1780 → ×1.375 = 2447.5 → ×0.8 = 1958 → 1960
assert.equal(lose.targets.calories, 1960); assert.equal(lose.targets.protein, 160);
assert.ok(lose.steps[2].includes('-20%'));
assert.deepEqual(M.manualTargets({ protein: 150, carbs: 200, fat: 60 }), { protein: 150, carbs: 200, fat: 60, calories: 1940 });
assert.equal(M.resolveTargets(null), null);
assert.equal(M.resolveTargets({ mode: 'manual', profile: null, manual: null }), null);
assert.equal(M.parseProfile({ age: '12', heightCm: '165', weightKg: '60' }, p).ok, false);
assert.equal(M.parseProfile({ age: '30', heightCm: '165', weightKg: '' }, p).ok, false);
assert.equal(M.parseProfile({ age: '30', heightCm: '165,5', weightKg: '60' }, p).ok, true);
assert.equal(M.parseManualMacros({ protein: '0', carbs: '0', fat: '0' }).ok, false);
assert.deepEqual(M.parsePortion('1.5', 'serving', 40), { ok: true, value: 60 });
assert.deepEqual(M.parsePortion('120', 'grams', 40), { ok: true, value: 120 });
for (const bad of ['', '0', '-1', 'abc']) assert.equal(M.parsePortion(bad, 'grams', 40).ok, false);
assert.equal(M.parsePortion('6000', 'grams', 40).ok, false);
const m = M.macrosForGrams({ calories: 297, protein: 9.6, carbs: 46.4, fat: 7.5 }, 80);
assert.ok(Math.abs(m.calories - 237.6) < 1e-9);
assert.deepEqual(M.sumMacros([]), { calories: 0, protein: 0, carbs: 0, fat: 0 });
const cf = M.parseCustomFood({ name: 'Test curd', servingLabel: '', servingGrams: '200', protein: '10', carbs: '5', fat: '2' });
assert.ok(cf.ok); assert.equal(cf.value.per100g.calories, 78); assert.equal(cf.value.servingLabel, '1 serving');
assert.equal(M.parseCustomFood({ name: 'x', servingLabel: '', servingGrams: '100', protein: '60', carbs: '30', fat: '20' }).ok, false);
assert.equal(M.parseCustomFood({ name: 'Too much', servingLabel: '', servingGrams: '100', protein: '60', carbs: '30', fat: '20' }).ok, false);
assert.equal(M.defaultMeal(new Date('2026-10-21T08:00:00')), 'breakfast');
assert.equal(M.defaultMeal(new Date('2026-10-21T13:00:00')), 'lunch');
assert.equal(M.defaultMeal(new Date('2026-10-21T17:00:00')), 'snack');
assert.equal(M.defaultMeal(new Date('2026-10-21T21:00:00')), 'dinner');
console.log('macro math, validation, portions: OK');

// ---- Database ----
const { raw, db } = openTestDb();
await migrate(db, 3);
raw.exec("INSERT INTO water_logs (logged_on, logged_at, amount_ml) VALUES ('2026-10-21','x',250)");
await migrate(db);
assert.equal((raw.prepare('PRAGMA user_version').get() as any).user_version, LATEST_VERSION);
assert.equal((raw.prepare('SELECT COUNT(*) n FROM water_logs').get() as any).n, 1);
console.log('v3 → v4 upgrade keeps data; foods seeded:', (raw.prepare('SELECT COUNT(*) n FROM foods').get() as any).n);

const dal = await searchFoods(db, 'dal');
console.log('search "dal":', dal.map(f => f.name));
assert.ok((await searchFoods(db, 'Ro'))[0].name.startsWith('Ro'), 'prefix matches first');
assert.deepEqual(await searchFoods(db, '%'), [], 'LIKE wildcards escaped');

const roti = (await searchFoods(db, 'roti'))[0];
await logFood(db, roti, 80, 'lunch', new Date('2026-10-21T13:00:00'));
await logFood(db, roti, 40, 'dinner', new Date('2026-10-20T21:00:00')); // different day
let logs = await getFoodLogs(db, '2026-10-21');
assert.equal(logs.length, 1); assert.ok(Math.abs(logs[0].calories - 237.6) < 1e-6); assert.equal(logs[0].meal, 'lunch');
// Snapshot: editing the food does not rewrite the log
raw.exec("UPDATE foods SET calories_100g = 999 WHERE name = 'Roti / chapati'");
assert.ok(Math.abs((await getFoodLogs(db, '2026-10-21'))[0].calories - 237.6) < 1e-6);
await deleteFoodLog(db, logs[0].id);
assert.equal((await getFoodLogs(db, '2026-10-21')).length, 0);
console.log('log / day filter / snapshot / delete: OK');

assert.ok(cf.ok);
assert.ok(await createFood(db, cf.value));
assert.equal(await createFood(db, { ...cf.value, name: 'TEST CURD' }), null, 'case-insensitive duplicate');
assert.equal((await searchFoods(db, 'test curd'))[0].source, 'custom');
console.log('custom food create + duplicate guard: OK');

assert.equal(await getMacroSettings(db), null);
await saveMacroSettings(db, { mode: 'auto', profile: p as any, manual: null });
assert.deepEqual(M.resolveTargets(await getMacroSettings(db)), r.targets);
await setSetting(db, 'macro_settings', '{broken');
assert.equal(await getMacroSettings(db), null, 'corrupt JSON → null, no crash');
console.log('settings round-trip + corrupt JSON guard: OK');
console.log('ALL MACRO CHECKS PASSED');
