import assert from 'node:assert/strict';
import { newUser } from '../support/cloud.mts';
import { openTestDb } from '../support/sqlite.mts';
import { migrate } from '@/db/local/migrations';
import { getImportMark, hasData, readLocalSnapshot, setImportMark, summarize } from '@/db/local/snapshot';
import { importLocalData } from '@/db/importLocal';
import { getFoodLogs } from '@/db/foodLogs';
import { searchFoods } from '@/db/foods';
import { getUserSettings } from '@/db/settings';
import { getActiveSplit, saveSplit } from '@/db/splits';
import { getTotalMl } from '@/db/water';
import { getActiveWorkout, getRecentWorkouts, getWorkoutDetail, startWorkout } from '@/db/workouts';
import { getExerciseHistory, searchExercises } from '@/db/exercises';
import { generateSplit } from '@/lib/split';

// A browser that never used the app has nothing to import.
assert.equal(await readLocalSnapshot(openTestDb().db), null);

// ---- A browser with a few weeks of pre-account data (local schema v4) ----
const { raw, db: local } = openTestDb();
await migrate(local);
raw.exec(`
  INSERT INTO settings VALUES ('units', 'imperial'), ('water_goal_glasses', '10'),
    ('macro_settings', '{"mode":"manual","profile":null,"manual":{"calories":2000,"protein":120,"carbs":220,"fat":60}}');
  INSERT INTO exercises (name, muscle_group, equipment, is_custom) VALUES ('Zercher Squat', 'other', 'other', 1);
  INSERT INTO foods (name, serving_label, serving_grams, calories_100g, protein_100g, carbs_100g, fat_100g, is_vegetarian, source)
    VALUES ('Amul protein lassi', '1 bottle', 200, 60, 7.5, 6, 0.5, 1, 'custom');
  INSERT INTO split_plans (name, inputs_json, created_at, is_active) VALUES ('Old plan', '{"daysPerWeek":2}', '2026-10-01T08:00:00Z', 0),
    ('Full Body', '{"daysPerWeek":3}', '2026-10-05T08:00:00Z', 1);
  INSERT INTO split_days (plan_id, day_index, weekday, title) VALUES (2, 0, 1, 'Full Body A');
  INSERT INTO split_day_exercises (split_day_id, position, exercise_id, sets, reps_min, reps_max, rest_sec)
    VALUES (1, 0, (SELECT id FROM exercises WHERE name = 'Back Squat'), 3, 5, 8, 120),
           (1, 1, (SELECT id FROM exercises WHERE name = 'Zercher Squat'), 3, 8, 10, 90);
  -- 1: finished, from the split; 2: no sets (dropped); 3: still in progress
  INSERT INTO workouts (performed_on, started_at, finished_at, split_day_id) VALUES
    ('2026-10-06', '2026-10-06T07:00:00Z', '2026-10-06T08:00:00Z', 1),
    ('2026-10-07', '2026-10-07T07:00:00Z', '2026-10-07T07:05:00Z', NULL),
    ('2026-10-08', '2026-10-08T07:00:00Z', NULL, NULL);
  INSERT INTO workout_exercises (workout_id, exercise_id, position, target_sets, target_reps_min, target_reps_max) VALUES
    (1, (SELECT id FROM exercises WHERE name = 'Back Squat'), 1, 3, 5, 8),
    (1, (SELECT id FROM exercises WHERE name = 'Zercher Squat'), 2, 3, 8, 10),
    (2, (SELECT id FROM exercises WHERE name = 'Back Squat'), 1, NULL, NULL, NULL),
    (3, (SELECT id FROM exercises WHERE name = 'Back Squat'), 1, NULL, NULL, NULL);
  INSERT INTO workout_sets (workout_exercise_id, set_number, reps, weight_kg, logged_at) VALUES
    (1, 1, 5, 80, '2026-10-06T07:10:00Z'), (1, 2, 5, 82.5, '2026-10-06T07:15:00Z'),
    (2, 1, 8, 40, '2026-10-06T07:30:00Z'),
    (4, 1, 5, 85, '2026-10-08T07:10:00Z');
  INSERT INTO water_logs (logged_on, logged_at, amount_ml) VALUES
    ('2026-10-06', '2026-10-06T09:00:00Z', 250), ('2026-10-06', '2026-10-06T12:00:00Z', 250);
  INSERT INTO food_logs (logged_on, logged_at, meal, food_id, food_name, grams, calories, protein, carbs, fat) VALUES
    ('2026-10-06', '2026-10-06T13:00:00Z', 'lunch', (SELECT id FROM foods WHERE name = 'Roti / chapati'), 'Roti / chapati', 80, 237.6, 7.7, 37.1, 6),
    ('2026-10-06', '2026-10-06T16:00:00Z', 'snack', (SELECT id FROM foods WHERE name = 'Amul protein lassi'), 'Amul protein lassi', 200, 120, 15, 12, 1);
`);

const snapshot = (await readLocalSnapshot(local))!;
assert.ok(hasData(snapshot));
assert.deepEqual(summarize(snapshot), { workouts: 2, sets: 4, foodLogs: 2, waterLogs: 2, splits: 2 });
assert.deepEqual(snapshot.settings, {
  units: 'imperial',
  water_goal_glasses: 10,
  macro_settings: { mode: 'manual', profile: null, manual: { calories: 2000, protein: 120, carbs: 220, fat: 60 } },
});
console.log('local snapshot read + summary: OK');

// ---- Import into a fresh account ----
const { db } = newUser();
assert.deepEqual(await importLocalData(db, snapshot), { workouts: 2, sets: 4, food_logs: 2, water_logs: 2 });

const settings = (await getUserSettings(db))!;
assert.equal(settings.units, 'imperial');
assert.equal(settings.water_goal_glasses, 10);
assert.equal(settings.macro_settings!.mode, 'manual');
assert.ok(settings.local_import_at);

const recent = await getRecentWorkouts(db);
assert.deepEqual(recent.map((w) => [w.performedOn, w.setCount]), [['2026-10-06', 3]]);
const active = (await getActiveWorkout(db))!;
assert.equal(active.performedOn, '2026-10-08', 'in-progress workout stays in progress');
const detail = (await getWorkoutDetail(db, recent[0].id))!;
assert.equal(detail.splitDayTitle, 'Full Body A');
assert.deepEqual(detail.exercises.map((e) => [e.name, e.target?.repsMax, e.sets.map((s) => s.weightKg)]), [
  ['Back Squat', 8, [80, 82.5]],
  ['Zercher Squat', 10, [40]],
]);
const zercher = (await searchExercises(db, 'zercher'))[0];
assert.equal(zercher.isCustom, true, 'custom exercise recreated in the account');
const squat = (await searchExercises(db, 'back squat'))[0];
assert.equal(squat.isCustom, false, 'built-in exercise matched by name, not duplicated');
assert.deepEqual((await getExerciseHistory(db, squat.id)).map((s) => s.weightKg), [80, 82.5, 85]);

const split = (await getActiveSplit(db))!;
assert.equal(split.name, 'Full Body');
assert.deepEqual(split.days[0].exercises.map((e) => [e.name, e.repsMin]), [['Back Squat', 5], ['Zercher Squat', 8]]);

assert.equal(await getTotalMl(db, '2026-10-06'), 500);
const food = await getFoodLogs(db, '2026-10-06');
assert.deepEqual(food.map((f) => [f.foodName, f.calories]), [['Roti / chapati', 237.6], ['Amul protein lassi', 120]]);
assert.equal((await searchFoods(db, 'amul protein lassi'))[0].source, 'custom', 'custom food recreated');
console.log('import: settings, workouts (empty dropped, active kept), splits, water, food, custom rows: OK');

await assert.rejects(importLocalData(db, snapshot), /already imported/);
assert.equal((await getRecentWorkouts(db)).length, 1, 'second import refused, nothing duplicated');
console.log('second import refused: OK');

await setImportMark(local, 'me@example.com');
assert.equal((await getImportMark(local))!.email, 'me@example.com');

// ---- Importing into an account that already has an active plan and workout ----
const busy = newUser().db;
const inputs = { goal: 'strength', daysPerWeek: 3, experience: 'beginner', equipment: ['barbell'] } as any;
await saveSplit(busy, inputs, generateSplit(inputs));
const cloudWorkout = await startWorkout(busy);
await importLocalData(busy, snapshot);
assert.equal((await getActiveSplit(busy))!.name, generateSplit(inputs).name, 'existing active plan stays active');
assert.equal((await getActiveWorkout(busy))!.id, cloudWorkout, 'existing workout stays the active one');
const closed = (await getRecentWorkouts(busy)).find((w) => w.performedOn === '2026-10-08')!;
assert.equal(new Date(closed.finishedAt!).toISOString(), '2026-10-08T07:10:00.000Z','imported in-progress workout closed at its last set');
console.log('import next to existing active plan/workout: OK');
console.log('ALL IMPORT CHECKS PASSED');
