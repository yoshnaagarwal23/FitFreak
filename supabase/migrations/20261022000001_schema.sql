-- FitFreak cloud schema (Supabase Postgres).
--
-- Every user-owned row carries user_id, filled from the caller's JWT, and row-level
-- security limits each user to their own rows. Built-in exercises and foods have
-- user_id NULL and are readable by everyone. Storage is metric, as in the app.
--
-- Child rows (sets, split days, …) also check that their parent belongs to the caller:
-- foreign keys bypass RLS, so without that check a user could attach rows to someone
-- else's workout by guessing its id.

-- ---------------------------------------------------------------------------
-- Reference data: built-in rows (user_id NULL) + each user's custom rows
-- ---------------------------------------------------------------------------

create table public.exercises (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  muscle_group text not null
    check (muscle_group in ('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'other')),
  equipment text not null
    check (equipment in ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other')),
  created_at timestamptz not null default now()
);
create unique index exercises_builtin_name_key on public.exercises (lower(name)) where user_id is null;
create unique index exercises_user_name_key on public.exercises (user_id, lower(name)) where user_id is not null;

create table public.foods (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  serving_label text not null check (length(serving_label) <= 60),
  serving_grams numeric not null check (serving_grams > 0 and serving_grams <= 2000),
  calories_100g numeric not null check (calories_100g >= 0 and calories_100g <= 1000),
  protein_100g numeric not null check (protein_100g between 0 and 100),
  carbs_100g numeric not null check (carbs_100g between 0 and 100),
  fat_100g numeric not null check (fat_100g between 0 and 100),
  is_vegetarian boolean not null default true,
  source text not null check (source in ('usda', 'ifct', 'estimate', 'custom')),
  created_at timestamptz not null default now()
);
create unique index foods_builtin_name_key on public.foods (lower(name)) where user_id is null;
create unique index foods_user_name_key on public.foods (user_id, lower(name)) where user_id is not null;

-- ---------------------------------------------------------------------------
-- Per-user settings (one row per user)
-- ---------------------------------------------------------------------------

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  water_goal_glasses int not null default 8 check (water_goal_glasses between 1 and 20),
  macro_settings jsonb,     -- MacroSettings from src/lib/macros.ts
  last_meal_plan jsonb,     -- { dateKey, raw, logged } from src/db/mealPlans.ts
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Water
-- ---------------------------------------------------------------------------

create table public.water_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on date not null,            -- the user's local date
  logged_at timestamptz not null default now(),
  amount_ml int not null check (amount_ml > 0 and amount_ml <= 5000)
);
create index water_logs_user_day on public.water_logs (user_id, logged_on);

-- ---------------------------------------------------------------------------
-- Splits
-- ---------------------------------------------------------------------------

create table public.split_plans (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  inputs jsonb not null,              -- SplitInputs used to generate it
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index split_plans_one_active on public.split_plans (user_id) where is_active;

create table public.split_days (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id bigint not null references public.split_plans (id) on delete cascade,
  day_index int not null,
  weekday int not null check (weekday between 1 and 7),   -- 1 = Mon … 7 = Sun
  title text not null check (length(trim(title)) between 1 and 60)
);
create index split_days_plan on public.split_days (plan_id);

create table public.split_day_exercises (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  split_day_id bigint not null references public.split_days (id) on delete cascade,
  position int not null,
  exercise_id bigint not null references public.exercises (id),
  sets int not null check (sets between 1 and 10),
  reps_min int not null check (reps_min between 1 and 50),
  reps_max int not null check (reps_max between 1 and 50),
  rest_sec int not null check (rest_sec between 0 and 600),
  check (reps_min <= reps_max)
);
create index split_day_exercises_day on public.split_day_exercises (split_day_id);

-- ---------------------------------------------------------------------------
-- Workouts
-- ---------------------------------------------------------------------------

create table public.workouts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  performed_on date not null,         -- the user's local date
  started_at timestamptz not null default now(),
  finished_at timestamptz,            -- NULL while in progress
  split_day_id bigint references public.split_days (id) on delete set null
);
create index workouts_user_started on public.workouts (user_id, started_at desc);
create unique index workouts_one_active on public.workouts (user_id) where finished_at is null;

create table public.workout_exercises (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id bigint not null references public.workouts (id) on delete cascade,
  exercise_id bigint not null references public.exercises (id),
  position int not null,
  target_sets int,
  target_reps_min int,
  target_reps_max int,
  unique (workout_id, exercise_id)
);
create index workout_exercises_exercise on public.workout_exercises (exercise_id);

create table public.workout_sets (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_exercise_id bigint not null references public.workout_exercises (id) on delete cascade,
  set_number int not null,
  reps int not null check (reps between 1 and 100),
  weight_kg numeric not null check (weight_kg between 0 and 1000),
  logged_at timestamptz not null default now()
);
create index workout_sets_we on public.workout_sets (workout_exercise_id);

-- ---------------------------------------------------------------------------
-- Food log (macros copied at log time so editing a food never rewrites history)
-- ---------------------------------------------------------------------------

create table public.food_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on date not null,
  logged_at timestamptz not null default now(),
  meal text not null check (meal in ('breakfast', 'lunch', 'snack', 'dinner')),
  food_id bigint references public.foods (id) on delete set null,
  food_name text not null,
  grams numeric not null check (grams > 0 and grams <= 5000),
  calories numeric not null check (calories >= 0),
  protein numeric not null check (protein >= 0),
  carbs numeric not null check (carbs >= 0),
  fat numeric not null check (fat >= 0)
);
create index food_logs_user_day on public.food_logs (user_id, logged_on);

-- ---------------------------------------------------------------------------
-- AI usage (written only by the backend with the service role; read by the user)
-- ---------------------------------------------------------------------------

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,                 -- e.g. 'meal_plan'
  used_at timestamptz not null default now()
);
create index ai_usage_user_time on public.ai_usage (user_id, used_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.exercises enable row level security;
alter table public.foods enable row level security;
alter table public.user_settings enable row level security;
alter table public.water_logs enable row level security;
alter table public.split_plans enable row level security;
alter table public.split_days enable row level security;
alter table public.split_day_exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.food_logs enable row level security;
alter table public.ai_usage enable row level security;

-- Reference tables: everyone reads built-ins; users manage only their own custom rows.
create policy "read built-in and own" on public.exercises for select
  using (user_id is null or user_id = (select auth.uid()));
create policy "insert own" on public.exercises for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "update own" on public.exercises for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own" on public.exercises for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "read built-in and own" on public.foods for select
  using (user_id is null or user_id = (select auth.uid()));
create policy "insert own" on public.foods for insert to authenticated
  with check (user_id = (select auth.uid()) and source = 'custom');
create policy "update own" on public.foods for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and source = 'custom');
create policy "delete own" on public.foods for delete to authenticated
  using (user_id = (select auth.uid()));

-- Tables with no parent: plain ownership.
create policy "own rows" on public.user_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.water_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.split_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Helpers for parent-ownership checks. SECURITY DEFINER so they can see the parent row
-- regardless of RLS, but they only answer "does this id belong to the caller?".
create function public.owns_workout(p_id bigint) returns boolean
  language sql stable security definer set search_path = '' as
  $$ select exists (select 1 from public.workouts where id = p_id and user_id = auth.uid()) $$;
create function public.owns_workout_exercise(p_id bigint) returns boolean
  language sql stable security definer set search_path = '' as
  $$ select exists (select 1 from public.workout_exercises where id = p_id and user_id = auth.uid()) $$;
create function public.owns_split_plan(p_id bigint) returns boolean
  language sql stable security definer set search_path = '' as
  $$ select exists (select 1 from public.split_plans where id = p_id and user_id = auth.uid()) $$;
create function public.owns_split_day(p_id bigint) returns boolean
  language sql stable security definer set search_path = '' as
  $$ select exists (select 1 from public.split_days where id = p_id and user_id = auth.uid()) $$;
create function public.can_use_exercise(p_id bigint) returns boolean
  language sql stable security definer set search_path = '' as
  $$ select exists (select 1 from public.exercises where id = p_id and (user_id is null or user_id = auth.uid())) $$;
create function public.can_use_food(p_id bigint) returns boolean
  language sql stable security definer set search_path = '' as
  $$ select p_id is null or exists (select 1 from public.foods where id = p_id and (user_id is null or user_id = auth.uid())) $$;

create policy "own rows" on public.split_days for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_split_plan(plan_id));
create policy "own rows" on public.split_day_exercises for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_split_day(split_day_id)
              and public.can_use_exercise(exercise_id));
create policy "own rows" on public.workouts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and (split_day_id is null or public.owns_split_day(split_day_id)));
create policy "own rows" on public.workout_exercises for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_workout(workout_id)
              and public.can_use_exercise(exercise_id));
create policy "own rows" on public.workout_sets for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_workout_exercise(workout_exercise_id));
create policy "own rows" on public.food_logs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_use_food(food_id));

revoke all on function public.owns_workout(bigint), public.owns_workout_exercise(bigint),
  public.owns_split_plan(bigint), public.owns_split_day(bigint),
  public.can_use_exercise(bigint), public.can_use_food(bigint) from public, anon;
grant execute on function public.owns_workout(bigint), public.owns_workout_exercise(bigint),
  public.owns_split_plan(bigint), public.owns_split_day(bigint),
  public.can_use_exercise(bigint), public.can_use_food(bigint) to authenticated;

-- The AI usage log is append-only from the backend; clients can only read it.
revoke insert, update, delete on public.ai_usage from anon, authenticated;
