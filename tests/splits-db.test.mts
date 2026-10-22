import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { openTestDb } from './support/sqlite.mts';
import { migrate, LATEST_VERSION } from '@/db/migrations';
import { saveSplit, getActiveSplit } from '@/db/splits';
import { startWorkoutFromSplitDay, getWorkoutDetail, addSet, finishWorkout, startWorkout } from '@/db/workouts';
import { generateSplit } from '@/lib/split';

const one = (raw: DatabaseSync, sql: string) => raw.prepare(sql).get() as any;


// ---- Upgrade: a v2 user with a finished workout and a custom "glute bridge" ----
const { raw, db } = openTestDb();
await migrate(db, 2);
assert.equal(one(raw, 'PRAGMA user_version').user_version, 2);
await db.runAsync("INSERT INTO exercises (name, muscle_group, equipment, is_custom) VALUES ('glute bridge', 'other', 'other', 1)");
const w0 = await startWorkout(db, new Date('2026-10-14T10:00:00'));
await db.runAsync('INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, 1, 1)', w0);
await addSet(db, 1, { weightKg: 60, reps: 8 });
await finishWorkout(db, w0);
const before = one(raw, 'SELECT COUNT(*) n FROM exercises').n;

await migrate(db);
assert.equal(one(raw, 'PRAGMA user_version').user_version, LATEST_VERSION);
assert.equal(one(raw, 'SELECT COUNT(*) n FROM workout_sets').n, 1);
assert.equal(one(raw, "SELECT is_custom FROM exercises WHERE name = 'Glute Bridge'").is_custom, 1);
assert.equal(one(raw, 'SELECT COUNT(*) n FROM exercises').n, before + 12); // 13 new, 1 already existed
const old = await getWorkoutDetail(db, w0);
assert.equal(old.splitDayTitle, null); assert.equal(old.exercises[0].target, null);
console.log('v2 → v3 upgrade: workout kept, custom "glute bridge" kept, 12 exercises added, old workouts have no targets');

// ---- Save a split and start a workout from it ----
const inputs = { goal: 'hypertrophy', daysPerWeek: 4, experience: 'beginner', equipment: ['barbell', 'dumbbell', 'machine', 'cable'] };
const plan = generateSplit(inputs);
await saveSplit(db, inputs, plan);
const saved = await getActiveSplit(db);
assert.equal(saved.name, 'Upper / Lower');
assert.deepEqual(saved.inputs, inputs);
assert.deepEqual(saved.days.map(d => d.exercises.map(e => e.name)), plan.days.map(d => d.exercises.map(e => e.name)));
console.log('saveSplit → getActiveSplit round-trips the plan');

const wid = await startWorkoutFromSplitDay(db, saved.days[0].id, new Date('2026-10-19T09:00:00'));
const detail = await getWorkoutDetail(db, wid);
assert.equal(detail.splitDayTitle, 'Upper A');
assert.deepEqual(detail.exercises.map(e => e.name), plan.days[0].exercises.map(e => e.name));
assert.deepEqual(detail.exercises[0].target, { sets: 3, repsMin: 6, repsMax: 10 });
assert.deepEqual(detail.exercises[0].lastSet, { weightKg: 60, reps: 8 }); // Bench Press history carries over
assert.equal(await startWorkoutFromSplitDay(db, saved.days[1].id), wid, 'should return the active workout');
console.log('startWorkoutFromSplitDay: exercises + targets copied, history prefill works, no double-start');

// ---- Re-saving keeps the old plan's days (past workouts reference them) ----
await saveSplit(db, { ...inputs, daysPerWeek: 3 }, generateSplit({ ...inputs, daysPerWeek: 3 }));
assert.equal(one(raw, 'SELECT COUNT(*) n FROM split_plans WHERE is_active = 1').n, 1);
assert.equal((await getActiveSplit(db)).days.length, 3);
assert.equal((await getWorkoutDetail(db, wid)).splitDayTitle, 'Upper A');
console.log('re-save: one active plan, old workout still linked to its day');
console.log('ALL V3 CHECKS PASSED');
