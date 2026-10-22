import assert from 'node:assert/strict';
import { generateSplit, CATALOG, GOAL_OPTIONS, EXPERIENCE_OPTIONS, EQUIPMENT_OPTIONS, clampDays } from '@/lib/split';
import { SEED_EXERCISES, SEED_EXERCISES_V3 } from '@/db/seedExercises';

// 1) Every catalog exercise exists in the library with the same equipment tag.
const library = new Map([...SEED_EXERCISES, ...SEED_EXERCISES_V3].map(e => [e.name, e.equipment]));
assert.equal(library.size, SEED_EXERCISES.length + SEED_EXERCISES_V3.length, 'duplicate seed names');
for (const [pattern, options] of Object.entries(CATALOG))
  for (const o of options) assert.equal(library.get(o.name), o.equipment, `${pattern}: ${o.name}`);
console.log('catalog ↔ library: OK');

// 2) Invariants over every input combination.
const equipSubsets = [];
for (let m = 0; m < 16; m++) equipSubsets.push(EQUIPMENT_OPTIONS.filter((_, i) => m & (1 << i)).map(o => o.value));
let n = 0, minExercises = Infinity, worst = null;
for (const { value: goal } of GOAL_OPTIONS) for (let days = 2; days <= 6; days++)
for (const { value: experience } of EXPERIENCE_OPTIONS) for (const equipment of equipSubsets) {
  const inputs = { goal, daysPerWeek: days, experience, equipment };
  const plan = generateSplit(inputs);
  assert.deepEqual(generateSplit(inputs), plan, 'not deterministic');
  assert.equal(plan.days.length, days);
  const wd = plan.days.map(d => d.weekday);
  assert.ok(wd.every((w, i) => w >= 1 && w <= 7 && (i === 0 || w > wd[i - 1])), 'weekdays');
  const avail = new Set([...equipment, 'bodyweight']);
  for (const d of plan.days) {
    const names = d.exercises.map(e => e.name);
    assert.equal(new Set(names).size, names.length, `dup in ${d.title}`);
    if (experience === 'beginner') assert.ok(names.length <= 5);
    for (const e of d.exercises) {
      assert.ok(avail.has(library.get(e.name)), `${e.name} needs ${library.get(e.name)}`);
      assert.ok(e.sets >= 2 && e.repsMin >= 1 && e.repsMin <= e.repsMax && e.restSec > 0);
    }
    if (names.length < minExercises) { minExercises = names.length; worst = `${JSON.stringify(inputs)} ${d.title}: ${names}`; }
  }
  n++;
}
console.log(`${n} combinations: OK · fewest exercises in any day = ${minExercises}\n  (${worst})`);

// 3) Specific rules.
const full = ['barbell', 'dumbbell', 'machine', 'cable'];
const p4 = generateSplit({ goal: 'hypertrophy', daysPerWeek: 4, experience: 'intermediate', equipment: full });
assert.equal(p4.name, 'Upper / Lower');
assert.deepEqual(p4.days.map(d => d.title), ['Upper A', 'Lower A', 'Upper B', 'Lower B']);
assert.notEqual(p4.days[0].exercises[0].name, p4.days[2].exercises[0].name, 'B day should vary');
assert.equal(generateSplit({ goal: 'general', daysPerWeek: 3, experience: 'beginner', equipment: full }).name, 'Full Body ×3');
assert.equal(generateSplit({ goal: 'general', daysPerWeek: 3, experience: 'advanced', equipment: full }).name, 'Push / Pull / Legs');
const str = generateSplit({ goal: 'strength', daysPerWeek: 3, experience: 'advanced', equipment: full });
assert.deepEqual([str.days[0].exercises[0].sets, str.days[0].exercises[0].repsMin, str.days[0].exercises[0].repsMax], [5, 3, 5]);
const bw = generateSplit({ goal: 'general', daysPerWeek: 3, experience: 'intermediate', equipment: [] });
assert.ok(bw.notes.some(x => x.startsWith('Skipped')), 'bodyweight-only should explain skipped slots');
assert.equal(clampDays(9), 6); assert.equal(clampDays(0), 2); assert.equal(clampDays(NaN), 4);
console.log('specific rules: OK');

console.log('\nExample — 4 days, muscle, beginner, full gym:');
const ex = generateSplit({ goal: 'hypertrophy', daysPerWeek: 4, experience: 'beginner', equipment: full });
console.log(' ', ex.name); ex.notes.forEach(x => console.log('  •', x));
ex.days.forEach(d => console.log(`  ${d.weekday} ${d.title}: ${d.exercises.map(e => `${e.name} ${e.sets}×${e.repsMin}-${e.repsMax}`).join(', ')}`));
console.log('\nExample — 3 days, general, intermediate, bodyweight only:');
bw.notes.forEach(x => console.log('  •', x));
bw.days.forEach(d => console.log(`  ${d.title}: ${d.exercises.map(e => e.name).join(', ')}`));
