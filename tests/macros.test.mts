import assert from 'node:assert/strict';
import * as M from '@/lib/macros';

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
console.log('ALL MACRO CHECKS PASSED');
