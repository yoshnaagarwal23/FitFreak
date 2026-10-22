import type { SQLiteDatabase } from 'expo-sqlite';

import { SEED_EXERCISES, SEED_EXERCISES_V3 } from './seedExercises';
import { SEED_FOODS } from './seedFoods';

type Migration = (db: SQLiteDatabase) => Promise<void>;

// Each entry upgrades the schema by one version. Never edit a shipped migration —
// append a new one instead. Index 0 takes the database from version 0 to 1.
const migrations: Migration[] = [
  // v1: water tracking + generic settings
  async (db) => {
    await db.execAsync(`
      CREATE TABLE water_logs (
        id INTEGER PRIMARY KEY NOT NULL,
        logged_on TEXT NOT NULL,      -- local date, YYYY-MM-DD
        logged_at TEXT NOT NULL,      -- ISO timestamp
        amount_ml INTEGER NOT NULL
      );
      CREATE INDEX idx_water_logs_logged_on ON water_logs (logged_on);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  },

  // v2: workout logging
  async (db) => {
    await db.execAsync(`
      CREATE TABLE exercises (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        muscle_group TEXT NOT NULL,
        equipment TEXT NOT NULL,
        is_custom INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE workouts (
        id INTEGER PRIMARY KEY NOT NULL,
        performed_on TEXT NOT NULL,   -- local date, YYYY-MM-DD
        started_at TEXT NOT NULL,     -- ISO timestamp
        finished_at TEXT              -- NULL while in progress
      );
      CREATE INDEX idx_workouts_performed_on ON workouts (performed_on);

      -- An exercise within one workout; exists before any sets are logged.
      CREATE TABLE workout_exercises (
        id INTEGER PRIMARY KEY NOT NULL,
        workout_id INTEGER NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises (id),
        position INTEGER NOT NULL,
        UNIQUE (workout_id, exercise_id)
      );
      CREATE INDEX idx_workout_exercises_exercise ON workout_exercises (exercise_id);

      CREATE TABLE workout_sets (
        id INTEGER PRIMARY KEY NOT NULL,
        workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises (id) ON DELETE CASCADE,
        set_number INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        weight_kg REAL NOT NULL,
        logged_at TEXT NOT NULL
      );
      CREATE INDEX idx_workout_sets_we ON workout_sets (workout_exercise_id);
    `);

    for (const e of SEED_EXERCISES) {
      await db.runAsync(
        'INSERT INTO exercises (name, muscle_group, equipment) VALUES (?, ?, ?)',
        e.name,
        e.muscleGroup,
        e.equipment,
      );
    }
  },

  // v3: saved splits + per-exercise targets on workouts
  async (db) => {
    await db.execAsync(`
      CREATE TABLE split_plans (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        inputs_json TEXT NOT NULL,    -- SplitInputs used to generate it
        created_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE split_days (
        id INTEGER PRIMARY KEY NOT NULL,
        plan_id INTEGER NOT NULL REFERENCES split_plans (id) ON DELETE CASCADE,
        day_index INTEGER NOT NULL,
        weekday INTEGER NOT NULL,     -- 1 = Mon … 7 = Sun
        title TEXT NOT NULL
      );

      CREATE TABLE split_day_exercises (
        id INTEGER PRIMARY KEY NOT NULL,
        split_day_id INTEGER NOT NULL REFERENCES split_days (id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        exercise_id INTEGER NOT NULL REFERENCES exercises (id),
        sets INTEGER NOT NULL,
        reps_min INTEGER NOT NULL,
        reps_max INTEGER NOT NULL,
        rest_sec INTEGER NOT NULL
      );

      -- Which split day a workout was started from, and the targets it was given.
      ALTER TABLE workouts ADD COLUMN split_day_id INTEGER REFERENCES split_days (id) ON DELETE SET NULL;
      ALTER TABLE workout_exercises ADD COLUMN target_sets INTEGER;
      ALTER TABLE workout_exercises ADD COLUMN target_reps_min INTEGER;
      ALTER TABLE workout_exercises ADD COLUMN target_reps_max INTEGER;
    `);

    // OR IGNORE: a user may already have a custom exercise with one of these names.
    for (const e of SEED_EXERCISES_V3) {
      await db.runAsync(
        'INSERT OR IGNORE INTO exercises (name, muscle_group, equipment) VALUES (?, ?, ?)',
        e.name,
        e.muscleGroup,
        e.equipment,
      );
    }
  },

  // v4: foods + food log
  async (db) => {
    await db.execAsync(`
      CREATE TABLE foods (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        serving_label TEXT NOT NULL,  -- e.g. "1 katori"
        serving_grams REAL NOT NULL,
        calories_100g REAL NOT NULL,
        protein_100g REAL NOT NULL,
        carbs_100g REAL NOT NULL,
        fat_100g REAL NOT NULL,
        is_vegetarian INTEGER NOT NULL DEFAULT 1,
        source TEXT NOT NULL          -- usda | ifct | estimate | custom
      );

      -- Macros are copied at log time so editing a food never rewrites history.
      CREATE TABLE food_logs (
        id INTEGER PRIMARY KEY NOT NULL,
        logged_on TEXT NOT NULL,      -- local date, YYYY-MM-DD
        logged_at TEXT NOT NULL,      -- ISO timestamp
        meal TEXT NOT NULL,           -- breakfast | lunch | snack | dinner
        food_id INTEGER REFERENCES foods (id) ON DELETE SET NULL,
        food_name TEXT NOT NULL,
        grams REAL NOT NULL,
        calories REAL NOT NULL,
        protein REAL NOT NULL,
        carbs REAL NOT NULL,
        fat REAL NOT NULL
      );
      CREATE INDEX idx_food_logs_logged_on ON food_logs (logged_on);
    `);

    for (const f of SEED_FOODS) {
      await db.runAsync(
        `INSERT INTO foods (name, serving_label, serving_grams, calories_100g, protein_100g,
                            carbs_100g, fat_100g, is_vegetarian, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        f.name,
        f.servingLabel,
        f.servingGrams,
        f.calories,
        f.protein,
        f.carbs,
        f.fat,
        f.vegetarian ? 1 : 0,
        f.source,
      );
    }
  },
];

export const LATEST_VERSION = migrations.length;

// `target` exists for tests (e.g. building an older schema to test upgrades); the app uses the default.
export async function migrate(db: SQLiteDatabase, target: number = LATEST_VERSION) {
  // Connection settings must be applied outside the migration transaction.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (row === null) {
    throw new Error('Could not read the database schema version');
  }
  const current = row.user_version;
  if (current > target) {
    throw new Error('Database schema is newer than this app supports');
  }
  if (current === target) {
    return;
  }

  await db.withTransactionAsync(async () => {
    for (let version = current; version < target; version++) {
      await migrations[version](db);
    }
    await db.execAsync(`PRAGMA user_version = ${target}`);
  });
}
