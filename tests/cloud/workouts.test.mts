import assert from 'node:assert/strict';
import { newUser, sql } from '../support/cloud.mts';
import * as S from '@/db/splits';
import * as W from '@/db/workouts';
import { createExercise, getExercise, getExerciseHistory, getLoggedExercises, searchExercises } from '@/db/exercises';
import { generateSplit, DEFAULT_MANUAL_TARGET } from '@/lib/split';

const { db } = newUser();
const bob = newUser().db;
const names = (d: { exercises: { name: string }[] }) => d.exercises.map((e) => e.name);

// ---- Exercises ----
assert.equal((await searchExercises(db, '')).length, 43);
assert.ok((await searchExercises(db, 'press')).every((e) => /press/i.test(e.name)));
const bench = (await searchExercises(db, 'bench press'))[0];
assert.equal(bench.isCustom, false);
assert.equal(await createExercise(db, '  bench PRESS '), bench.id, 'existing name returns the built-in');
const zercher = await createExercise(db, 'Zercher Squat');
assert.equal((await getExercise(db, zercher))!.isCustom, true);
assert.equal(await createExercise(db, 'zercher squat'), zercher, 'own custom found case-insensitively');
assert.equal(await getExercise(bob, zercher), null, 'custom exercises are private');
console.log('exercise search / create / privacy: OK');

// ---- Freestyle workout: sets, renumbering, history ----
const w0 = await W.startWorkout(db, new Date('2026-10-14T10:00:00'));
assert.equal(await W.startWorkout(db), w0, 'only one active workout');
await W.addExerciseToWorkout(db, w0, bench.id);
await W.addExerciseToWorkout(db, w0, bench.id); // duplicate: no-op
await W.addExerciseToWorkout(db, w0, zercher);
let d0 = (await W.getWorkoutDetail(db, w0))!;
assert.deepEqual(names(d0), ['Bench Press', 'Zercher Squat']);
assert.equal(d0.exercises[0].lastSet, null);
const be = d0.exercises[0].id;
await W.addSet(db, be, { weightKg: 50, reps: 10 });
await W.addSet(db, be, { weightKg: 60, reps: 8 });
await W.addSet(db, be, { weightKg: 62.5, reps: 6 });
d0 = (await W.getWorkoutDetail(db, w0))!;
await W.deleteSet(db, d0.exercises[0].sets[0].id);
d0 = (await W.getWorkoutDetail(db, w0))!;
assert.deepEqual(d0.exercises[0].sets.map((s) => [s.setNumber, s.weightKg, s.reps]), [[1, 60, 8], [2, 62.5, 6]]);
await W.removeExerciseFromWorkout(db, d0.exercises[1].id);
assert.equal((await W.getActiveWorkout(db))!.id, w0);
await W.finishWorkout(db, w0);
assert.equal(await W.getActiveWorkout(db), null);
console.log('sets add / delete-renumber / remove exercise / finish: OK');

const empty = await W.startWorkout(db);
await W.finishWorkout(db, empty);
assert.equal(await W.getWorkoutDetail(db, empty), null, 'empty workout discarded');

const recent = await W.getRecentWorkouts(db);
assert.equal(recent.length, 1);
assert.deepEqual([recent[0].exerciseCount, recent[0].setCount, recent[0].volumeKg], [1, 2, 60 * 8 + 62.5 * 6]);
assert.equal(recent[0].performedOn, '2026-10-14');
const logged = await getLoggedExercises(db);
assert.deepEqual(logged.map((e) => [e.name, e.sessionCount, e.topWeightKg]), [['Bench Press', 1, 62.5]]);
assert.deepEqual((await getExerciseHistory(db, bench.id)).map((r) => r.weightKg), [60, 62.5]);
console.log('recent workouts / logged exercises / history: OK');

// ---- Save a split and start a workout from it ----
const inputs = { goal: 'hypertrophy', daysPerWeek: 4, experience: 'beginner', equipment: ['barbell', 'dumbbell', 'machine', 'cable'] } as const;
const plan = generateSplit(inputs as any);
await S.saveSplit(db, inputs as any, plan);
const saved = (await S.getActiveSplit(db))!;
assert.equal(saved.name, 'Upper / Lower');
assert.deepEqual(saved.inputs, inputs);
assert.deepEqual(saved.days.map(names), plan.days.map(names));
console.log('saveSplit → getActiveSplit round-trips the plan');

const wid = await W.startWorkoutFromSplitDay(db, saved.days[0].id, new Date('2026-10-19T09:00:00'));
const detail = (await W.getWorkoutDetail(db, wid))!;
assert.equal(detail.splitDayTitle, 'Upper A');
assert.deepEqual(names(detail), names(plan.days[0]));
assert.deepEqual(detail.exercises[0].target, { sets: 3, repsMin: 6, repsMax: 10 });
assert.deepEqual(detail.exercises[0].lastSet, { weightKg: 62.5, reps: 6 }, 'prefill from the latest bench set');
assert.equal(await W.startWorkoutFromSplitDay(db, saved.days[1].id), wid, 'returns the active workout');
await W.addSet(db, detail.exercises[0].id, { weightKg: 65, reps: 6 });
await W.finishWorkout(db, wid);
const targetBefore = (await W.getWorkoutDetail(db, wid))!.exercises[0].target;
console.log('startWorkoutFromSplitDay: exercises + targets copied, prefill, no double-start');

// ---- Editing a split day ----
const upper = saved.days[0];
await S.updateSplitDay(db, upper.id, { title: 'Chest Day', weekday: 7 });
await S.updateSplitExerciseTarget(db, upper.exercises[0].id, { sets: 5, repsMin: 4, repsMax: 6 });
await S.moveSplitExercise(db, upper.exercises[0].id, 1);
await S.moveSplitExercise(db, upper.exercises[0].id, -1); // back to top
await S.moveSplitExercise(db, upper.exercises[0].id, -1); // already first: no-op
const last = upper.exercises.length - 1;
await S.removeSplitExercise(db, upper.exercises[last].id);
const dips = (await searchExercises(db, 'dips'))[0];
await S.addExerciseToSplitDay(db, upper.id, dips.id);
await S.addExerciseToSplitDay(db, upper.id, dips.id); // duplicate: no-op
const day = (await S.getSplitDay(db, upper.id))!;
assert.equal(day.title, 'Chest Day');
assert.equal(day.weekday, 7);
assert.equal(day.planId, saved.id);
assert.deepEqual([day.exercises[0].sets, day.exercises[0].repsMin, day.exercises[0].repsMax], [5, 4, 6]);
assert.deepEqual(names(day), [...names(upper).slice(0, last), 'Dips']);
const added = day.exercises[day.exercises.length - 1];
assert.deepEqual(
  { sets: added.sets, repsMin: added.repsMin, repsMax: added.repsMax, restSec: added.restSec },
  DEFAULT_MANUAL_TARGET,
  'database defaults match DEFAULT_MANUAL_TARGET',
);
const resorted = (await S.getActiveSplit(db))!;
assert.equal(resorted.days[resorted.days.length - 1].title, 'Chest Day', 'days sorted by weekday');
assert.deepEqual((await W.getWorkoutDetail(db, wid))!.exercises[0].target, targetBefore, 'past targets unchanged');
console.log('edit day: rename, weekday, target, reorder, remove, add (no dup); past workout unchanged: OK');

const newDay = await S.addSplitDay(db, saved.id, 4);
assert.equal((await S.getSplitDay(db, newDay))!.title, 'Custom');
await S.deleteSplitDay(db, upper.id);
assert.equal(await S.getSplitDay(db, upper.id), null);
assert.equal(sql(`select count(*) from split_day_exercises where split_day_id = ${upper.id}`), '0');
const after = (await W.getWorkoutDetail(db, wid))!;
assert.equal(after.splitDayTitle, null);
assert.equal(after.exercises[0].sets.length, 1);
console.log('add day / delete day (cascade) — past workout keeps its sets: OK');

// ---- Re-saving keeps old plans inactive ----
await S.saveSplit(db, { ...inputs, daysPerWeek: 3 } as any, generateSplit({ ...inputs, daysPerWeek: 3 } as any));
assert.equal((await S.getActiveSplit(db))!.days.length, 3);
assert.equal(sql(`select count(*) from split_plans where user_id = (select user_id from workouts where id = ${wid})`), '2');
console.log('re-save: one active plan, old plan kept');

// ---- Another account sees and changes nothing ----
assert.equal(await W.getWorkoutDetail(bob, wid), null);
assert.deepEqual(await W.getRecentWorkouts(bob), []);
assert.deepEqual(await getLoggedExercises(bob), []);
assert.equal(await S.getActiveSplit(bob), null);
await S.updateSplitDay(bob, newDay, { title: 'Hijacked' });
assert.equal((await S.getSplitDay(db, newDay))!.title, 'Custom');
await W.deleteSet(bob, after.exercises[0].sets[0].id);
assert.equal((await W.getWorkoutDetail(db, wid))!.exercises[0].sets.length, 1);
await assert.rejects(W.addSet(bob, after.exercises[0].id, { weightKg: 100, reps: 5 }), /row-level security/);
console.log('cross-account reads and writes blocked: OK');
console.log('ALL CLOUD WORKOUT CHECKS PASSED');
