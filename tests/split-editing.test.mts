import assert from 'node:assert/strict';
import { adjustTarget, firstFreeWeekday } from '@/lib/split';

// Pure split-editing helpers. Editing a saved split in the database is tested in tests/cloud.
assert.deepEqual(adjustTarget({ sets: 3, repsMin: 8, repsMax: 8 }, 'repsMin', 1), { sets: 3, repsMin: 9, repsMax: 9 });
assert.deepEqual(adjustTarget({ sets: 3, repsMin: 8, repsMax: 8 }, 'repsMax', -1), { sets: 3, repsMin: 7, repsMax: 7 });
assert.deepEqual(adjustTarget({ sets: 1, repsMin: 1, repsMax: 50 }, 'sets', -1), { sets: 1, repsMin: 1, repsMax: 50 });
assert.deepEqual(adjustTarget({ sets: 10, repsMin: 1, repsMax: 50 }, 'repsMax', 1).repsMax, 50);
assert.equal(firstFreeWeekday([1, 2, 4]), 3); assert.equal(firstFreeWeekday([1,2,3,4,5,6,7]), null);
console.log('adjustTarget / firstFreeWeekday: OK');
