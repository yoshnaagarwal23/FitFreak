import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { openTestDb } from './support/sqlite.mts';
import { migrate, LATEST_VERSION } from '@/db/local/migrations';

// The local SQLite schema. The app no longer writes to it, but the one-time import
// still reads (and upgrades) databases created by older versions.
const version = (raw: DatabaseSync) => (raw.prepare('PRAGMA user_version').get() as any).user_version;

// 1) Fresh install
const { raw: fresh, db: freshDb } = openTestDb();
await migrate(freshDb);
assert.equal(version(fresh), LATEST_VERSION);
const n = (fresh.prepare('SELECT COUNT(*) AS n FROM exercises').get() as any).n;
console.log('fresh install: version', version(fresh), '· seeded exercises', n);

// 2) Upgrade from a v1 database that has water data (what an existing user has)
const { raw: old, db: oldDb } = openTestDb();
old.exec(`CREATE TABLE water_logs (id INTEGER PRIMARY KEY NOT NULL, logged_on TEXT NOT NULL, logged_at TEXT NOT NULL, amount_ml INTEGER NOT NULL);
  CREATE INDEX idx_water_logs_logged_on ON water_logs (logged_on);
  CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  INSERT INTO water_logs (logged_on, logged_at, amount_ml) VALUES ('2026-10-20','2026-10-20T10:00:00Z',250),('2026-10-20','2026-10-20T11:00:00Z',250);
  INSERT INTO settings VALUES ('water_goal_glasses','10');
  PRAGMA user_version = 1;`);
await migrate(oldDb);
assert.equal(version(old), LATEST_VERSION);
assert.equal((old.prepare('SELECT SUM(amount_ml) AS s FROM water_logs').get() as any).s, 500);
assert.equal((old.prepare("SELECT value FROM settings WHERE key='water_goal_glasses'").get() as any).value, '10');
console.log('v1 -> v2 upgrade: water data and goal preserved');

// 3) Re-running is a no-op
await migrate(oldDb);
assert.equal((old.prepare('SELECT COUNT(*) AS n FROM exercises').get() as any).n, n);
console.log('re-run: no duplicate seeds');

// 4) Cascade: deleting a workout removes its exercises and sets (foreign keys on)
const db = oldDb;
await db.execAsync("INSERT INTO workouts (performed_on, started_at) VALUES ('2026-10-20','x'); INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (1,1,1); INSERT INTO workout_sets (workout_exercise_id,set_number,reps,weight_kg,logged_at) VALUES (1,1,5,60,'x');");
await db.execAsync('DELETE FROM workouts WHERE id = 1');
assert.equal((old.prepare('SELECT COUNT(*) AS n FROM workout_sets').get() as any).n, 0);
console.log('cascade delete works');

// 5) v2 → v3: a custom exercise whose name a new built-in also uses is kept, not duplicated
const { raw: v2, db: v2Db } = openTestDb();
await migrate(v2Db, 2);
v2.exec(`INSERT INTO exercises (name, muscle_group, equipment, is_custom) VALUES ('glute bridge', 'other', 'other', 1);
  INSERT INTO workouts (performed_on, started_at, finished_at) VALUES ('2026-10-14', 'x', 'y');
  INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (1, 1, 1);
  INSERT INTO workout_sets (workout_exercise_id, set_number, reps, weight_kg, logged_at) VALUES (1, 1, 8, 60, 'x');`);
const before = (v2.prepare('SELECT COUNT(*) AS n FROM exercises').get() as any).n;
await migrate(v2Db);
assert.equal((v2.prepare('SELECT COUNT(*) AS n FROM workout_sets').get() as any).n, 1);
assert.equal((v2.prepare("SELECT is_custom FROM exercises WHERE name = 'Glute Bridge'").get() as any).is_custom, 1);
assert.equal((v2.prepare('SELECT COUNT(*) AS n FROM exercises').get() as any).n, before + 12); // 13 new, 1 already existed
assert.equal((v2.prepare('SELECT target_sets FROM workout_exercises').get() as any).target_sets, null);
console.log('v2 → v3 upgrade: workout kept, custom "glute bridge" kept, 12 exercises added');
console.log('ALL MIGRATION CHECKS PASSED');
