import assert from 'node:assert/strict';
import * as U from '@/lib/units';
import { parseSetInput, formatSet, formatWeight } from '@/lib/workout';
import { parseBodyDraft, bodyDraftFrom, calculateTargets, parsePortion, EMPTY_BODY_DRAFT } from '@/lib/macros';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
// Exact definitions
close(U.lbToKg(1), 0.45359237); close(U.kgToLb(U.lbToKg(225)), 225);
close(U.ftInToCm(5, 10), 177.8); close(U.ozToG(1), 28.349523125); close(U.mlToFlOz(29.5735295625), 1);
assert.deepEqual(U.cmToFtIn(177.8), { ft: 5, in: 10 });
assert.deepEqual(U.cmToFtIn(182.6), { ft: 6, in: 0 }, '71.9 in rounds to 6′ 0″, not 5′ 12″');
assert.equal(U.formatHeight(165, 'imperial'), '5′ 5″'); assert.equal(U.formatHeight(165, 'metric'), '165 cm');
assert.equal(U.formatMass(61.235, 'metric'), '61.2 kg'); assert.equal(U.formatMass(U.lbToKg(135), 'imperial'), '135 lb');
assert.equal(U.formatFoodMass(80, 'metric'), '80 g'); assert.equal(U.formatFoodMass(80, 'imperial'), '2.8 oz');
assert.equal(U.formatVolume(750, 'metric'), '750 ml'); assert.equal(U.formatVolume(750, 'imperial'), '25 fl oz');
console.log('conversions: OK');

// Lifting: round trip through storage keeps the number the user typed
const lb = parseSetInput('135', '5', 'imperial');
assert.ok(lb.ok); close(lb.set.weightKg, 61.235, 1e-3);
assert.equal(formatSet(lb.set, 'imperial'), '135 lb × 5');
assert.equal(formatSet(lb.set, 'metric'), '61.2 kg × 5');
for (const w of [2.5, 45, 135, 225, 315, 405, 137.5]) {
  const p = parseSetInput(String(w), '1', 'imperial'); assert.ok(p.ok);
  assert.equal(U.kgToUserMass(p.set.weightKg, 'imperial'), w, `${w} lb round trip`);
}
assert.equal(formatWeight(0, 'imperial'), 'BW');
const tooHeavy = parseSetInput('2300', '1', 'imperial'); assert.ok(!tooHeavy.ok); assert.match(tooHeavy.error, /0–2204 lb/);
assert.ok(parseSetInput('2204', '1', 'imperial').ok);
const kgErr = parseSetInput('1001', '1', 'metric'); assert.ok(!kgErr.ok); assert.match(kgErr.error, /0–1000 kg/);
console.log('set entry in lb: round trips exactly, limits in user units: OK');

// Body stats: 5'5", 132 lb gives the same targets as 165 cm / 60 kg
const rest = { sex: 'female', activity: 'moderate', goal: 'maintain' } as const;
const imp = parseBodyDraft({ ...EMPTY_BODY_DRAFT, age: '30', heightFt: '5', heightIn: '5', weightLb: '132' }, 'imperial', rest);
assert.ok(imp.ok); close(imp.value.heightCm, 165.1, 1e-9); close(imp.value.weightKg, 59.87, 1e-9);
assert.deepEqual(calculateTargets(imp.value).targets, { calories: 2050, protein: 96, carbs: 288, fat: 57 });
assert.match(calculateTargets(imp.value, 'imperial').steps[3], /59\.9 kg \(132 lb\)/);
const blankIn = parseBodyDraft({ ...EMPTY_BODY_DRAFT, age: '30', heightFt: '6', heightIn: '', weightLb: '180' }, 'imperial', rest);
assert.ok(blankIn.ok); close(blankIn.value.heightCm, 182.9, 1e-9);
for (const [d, re] of [
  [{ heightFt: '2', heightIn: '0', weightLb: '150' }, /Height \(ft\)/],
  [{ heightFt: '5', heightIn: '13', weightLb: '150' }, /Inches/],
  [{ heightFt: '5', heightIn: '6', weightLb: '50' }, /Weight \(lb\)/],
  [{ heightFt: '3', heightIn: '2', weightLb: '150' }, /3′ 4″/],
] as const) {
  const r = parseBodyDraft({ ...EMPTY_BODY_DRAFT, age: '30', ...d }, 'imperial', rest); assert.ok(!r.ok); assert.match(r.error, re);
}
const draft = bodyDraftFrom({ age: 30, heightCm: 165, weightKg: 60 });
assert.deepEqual([draft.heightFt, draft.heightIn, draft.weightLb], ['5', '5', '132.3']);
console.log('body stats in ft/in/lb: same targets as metric, validation in user units: OK');

// Food portions in ounces
const oz = parsePortion('2', 'ounces', 40); assert.ok(oz.ok); close(oz.value, 56.7, 1e-9);
const big = parsePortion('200', 'ounces', 40); assert.ok(!big.ok); assert.match(big.error, /176 oz/);
console.log('portions in oz: OK');
console.log('ALL UNIT CHECKS PASSED');
