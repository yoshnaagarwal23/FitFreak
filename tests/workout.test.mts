import assert from 'node:assert/strict';
import { estimate1RM, volume, bestSet, groupSessions, parseSetInput, formatWeight, formatSet } from '@/lib/workout';
assert.equal(estimate1RM({ weightKg: 100, reps: 1 }), 100);
assert.equal(estimate1RM({ weightKg: 60, reps: 10 }), 80);
assert.equal(estimate1RM({ weightKg: 0, reps: 10 }), 0);
assert.equal(volume([{ weightKg: 60, reps: 8 }, { weightKg: 62.5, reps: 6 }]), 855);
assert.deepEqual(bestSet([{ weightKg: 60, reps: 10 }, { weightKg: 75, reps: 3 }]), { weightKg: 75, reps: 3 });
assert.equal(bestSet([]), null);
const s = groupSessions([
  { workoutId: 1, performedOn: '2026-10-01', weightKg: 60, reps: 10 },
  { workoutId: 1, performedOn: '2026-10-01', weightKg: 75, reps: 3 },
  { workoutId: 2, performedOn: '2026-10-04', weightKg: 80, reps: 1 },
]);
assert.equal(s.length, 2); assert.equal(s[0].best1RM, 82.5); assert.equal(s[1].best1RM, 80); assert.equal(s[0].sets.length, 2);
assert.deepEqual(parseSetInput('62,5', '8', 'metric'), { ok: true, set: { weightKg: 62.5, reps: 8 } });
assert.deepEqual(parseSetInput('0', '12', 'metric'), { ok: true, set: { weightKg: 0, reps: 12 } });
for (const [w, r] of [['', '8'], ['abc', '8'], ['-5', '8'], ['2000', '8'], ['60', '0'], ['60', '8.5'], ['60', ''], ['60', '101']]) {
  assert.equal(parseSetInput(w, r, 'metric').ok, false, `${w}/${r} should fail`);
}
assert.equal(formatWeight(82.5, 'metric'), '82.5 kg'); assert.equal(formatWeight(80, 'metric'), '80 kg'); assert.equal(formatWeight(0, 'metric'), 'BW');
assert.equal(formatSet({ weightKg: 60, reps: 8 }, 'metric'), '60 kg × 8'); assert.equal(formatSet({ weightKg: 0, reps: 12 }, 'metric'), 'BW × 12');
console.log('ALL LIB CHECKS PASSED');
