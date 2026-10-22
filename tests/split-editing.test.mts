import assert from 'node:assert/strict';
import { openTestDb } from './support/sqlite.mts';
import { migrate } from '@/db/migrations';
import * as S from '@/db/splits';
import { startWorkoutFromSplitDay, getWorkoutDetail, addSet, finishWorkout } from '@/db/workouts';
import { generateSplit, adjustTarget, firstFreeWeekday } from '@/lib/split';

// Pure helpers
assert.deepEqual(adjustTarget({ sets: 3, repsMin: 8, repsMax: 8 }, 'repsMin', 1), { sets: 3, repsMin: 9, repsMax: 9 });
assert.deepEqual(adjustTarget({ sets: 3, repsMin: 8, repsMax: 8 }, 'repsMax', -1), { sets: 3, repsMin: 7, repsMax: 7 });
assert.deepEqual(adjustTarget({ sets: 1, repsMin: 1, repsMax: 50 }, 'sets', -1), { sets: 1, repsMin: 1, repsMax: 50 });
assert.deepEqual(adjustTarget({ sets: 10, repsMin: 1, repsMax: 50 }, 'repsMax', 1).repsMax, 50);
assert.equal(firstFreeWeekday([1, 2, 4]), 3); assert.equal(firstFreeWeekday([1,2,3,4,5,6,7]), null);
console.log('adjustTarget / firstFreeWeekday: OK');

const { raw, db } = openTestDb();
await migrate(db);
const inputs = { goal: 'hypertrophy', daysPerWeek: 3, experience: 'intermediate', equipment: ['barbell', 'dumbbell', 'machine', 'cable'] };
await S.saveSplit(db, inputs, generateSplit(inputs));
let split = await S.getActiveSplit(db);
const push = split.days[0];
const names = (d: any) => d.exercises.map((e: any) => e.name);

// Workout started BEFORE edits keeps its own targets
const w = await startWorkoutFromSplitDay(db, push.id);
await addSet(db, (await getWorkoutDetail(db, w)).exercises[0].id, { weightKg: 50, reps: 8 });
await finishWorkout(db, w);
const targetBefore = (await getWorkoutDetail(db, w)).exercises[0].target;

await S.updateSplitDay(db, push.id, { title: 'Chest Day', weekday: 7 });
await S.updateSplitExerciseTarget(db, push.exercises[0].id, { sets: 5, repsMin: 4, repsMax: 6 });
await S.moveSplitExercise(db, push.exercises[0].id, 1);
await S.moveSplitExercise(db, push.exercises[0].id, -1); // back to top
await S.moveSplitExercise(db, push.exercises[0].id, -1); // already first: no-op
await S.removeSplitExercise(db, push.exercises[4].id);
const dipsId = (raw.prepare("SELECT id FROM exercises WHERE name = 'Dips'").get() as any).id;
await S.addExerciseToSplitDay(db, push.id, dipsId);
await S.addExerciseToSplitDay(db, push.id, dipsId); // duplicate: no-op
let day = await S.getSplitDay(db, push.id);
assert.equal(day.title, 'Chest Day'); assert.equal(day.weekday, 7);
assert.deepEqual([day.exercises[0].sets, day.exercises[0].repsMin, day.exercises[0].repsMax], [5, 4, 6]);
assert.deepEqual(names(day), [...names(push).slice(0, 4), 'Dips']);
assert.deepEqual([day.exercises[4].sets, day.exercises[4].repsMin, day.exercises[4].repsMax], [3, 8, 12]);
console.log('edit day: rename, weekday, target, reorder, remove, add (no dup): OK');

split = await S.getActiveSplit(db);
assert.equal(split.days[split.days.length - 1].title, 'Chest Day', 'days sorted by weekday');
assert.deepEqual((await getWorkoutDetail(db, w)).exercises[0].target, targetBefore);
console.log('days re-sort by weekday; past workout targets unchanged: OK');

const newDay = await S.addSplitDay(db, split.id, 4);
assert.equal((await S.getSplitDay(db, newDay)).title, 'Custom');
await S.deleteSplitDay(db, push.id);
assert.equal(await S.getSplitDay(db, push.id), null);
assert.equal(raw.prepare('SELECT COUNT(*) n FROM split_day_exercises WHERE split_day_id = ?').get(push.id).n, 0);
const after = await getWorkoutDetail(db, w);
assert.equal(after.splitDayTitle, null); assert.equal(after.exercises[0].sets.length, 1);
console.log('add day / delete day (cascade) — past workout keeps its sets: OK');
console.log('ALL EDIT CHECKS PASSED');
