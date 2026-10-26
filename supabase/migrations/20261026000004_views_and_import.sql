-- Read-only views for the app's aggregate screens, and a one-time import of the data a
-- user logged in the browser before accounts existed.

-- security_invoker: the views run as the caller, so the tables' row-level security
-- applies and each user only ever sees their own rows.

-- Finished workouts with set count and volume (Workouts tab).
create view public.workout_summaries with (security_invoker = true) as
select w.id, w.performed_on, w.started_at, w.finished_at,
       count(distinct s.workout_exercise_id)::int as exercise_count,
       count(s.id)::int as set_count,
       coalesce(sum(s.weight_kg * s.reps), 0) as volume_kg
from public.workouts w
left join public.workout_exercises we on we.workout_id = w.id
left join public.workout_sets s on s.workout_exercise_id = we.id
where w.finished_at is not null
group by w.id;

-- Every logged set with its exercise and workout date (lift history, Progress tab).
create view public.exercise_sets with (security_invoker = true) as
select s.id, we.exercise_id, e.name as exercise_name, w.id as workout_id, w.performed_on,
       w.started_at, s.set_number, s.reps, s.weight_kg, s.logged_at
from public.workout_sets s
join public.workout_exercises we on we.id = s.workout_exercise_id
join public.workouts w on w.id = we.workout_id
join public.exercises e on e.id = we.exercise_id;

-- The most recent set of each exercise, for prefilling the next one.
create view public.last_sets with (security_invoker = true) as
select distinct on (we.exercise_id) we.exercise_id, s.weight_kg, s.reps
from public.workout_sets s
join public.workout_exercises we on we.id = s.workout_exercise_id
order by we.exercise_id, s.logged_at desc, s.id desc;

-- Exercises with at least one logged set, for the Progress tab.
create view public.logged_exercises with (security_invoker = true) as
select exercise_id as id, exercise_name as name,
       count(distinct workout_id)::int as session_count,
       max(performed_on) as last_performed_on,
       max(weight_kg) as top_weight_kg
from public.exercise_sets
group by exercise_id, exercise_name;

revoke all on public.workout_summaries, public.exercise_sets, public.last_sets, public.logged_exercises from anon;
grant select on public.workout_summaries, public.exercise_sets, public.last_sets, public.logged_exercises
  to authenticated;

-- Custom exercises and foods belong to whoever creates them, without the app sending
-- user_id. Built-in rows are inserted by migrations, where auth.uid() is NULL.
alter table public.exercises alter column user_id set default auth.uid();
alter table public.foods alter column user_id set default auth.uid();

-- ---------------------------------------------------------------------------
-- One-time import of local (pre-account) data
-- ---------------------------------------------------------------------------

alter table public.user_settings add column local_import_at timestamptz;

-- p_data is a snapshot of the app's local SQLite tables, rows keyed by their local ids:
--   { settings: {units?, water_goal_glasses?, macro_settings?},
--     exercises, foods, water_logs, split_plans, split_days, split_day_exercises,
--     workouts, workout_exercises, workout_sets, food_logs }
-- Local ids are remapped to new cloud ids. Exercises and foods are matched by name to
-- built-in rows (then to the user's own), and anything else becomes a custom row.
-- Runs as the caller (SECURITY INVOKER), so every insert passes row-level security, and
-- in one transaction: any bad row aborts the whole import. Allowed once per account.
create function public.import_local_data(p_data jsonb) returns jsonb
  language plpgsql set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  ex_map jsonb := '{}';
  food_map jsonb := '{}';
  plan_map jsonb := '{}';
  day_map jsonb := '{}';
  workout_map jsonb := '{}';
  we_map jsonb := '{}';
  r jsonb;
  v_id bigint;
  v_has_active_plan boolean;
  v_has_active_workout boolean;
  v_finished timestamptz;
  last_set_at jsonb;
  n_workouts int := 0;
  n_sets int := 0;
  n_food int := 0;
  n_water int := 0;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_settings where user_id = v_uid and local_import_at is not null) then
    raise exception 'This account has already imported local data' using errcode = 'P0001';
  end if;

  -- Settings: local values win where the browser had them set.
  insert into public.user_settings (user_id, units, water_goal_glasses, macro_settings, local_import_at)
  values (v_uid,
          coalesce(p_data->'settings'->>'units', 'metric'),
          coalesce((p_data->'settings'->>'water_goal_glasses')::int, 8),
          p_data->'settings'->'macro_settings',
          now())
  on conflict (user_id) do update set
    units = coalesce(p_data->'settings'->>'units', public.user_settings.units),
    water_goal_glasses = coalesce((p_data->'settings'->>'water_goal_glasses')::int,
                                  public.user_settings.water_goal_glasses),
    macro_settings = coalesce(p_data->'settings'->'macro_settings', public.user_settings.macro_settings),
    local_import_at = now();

  for r in select * from jsonb_array_elements(coalesce(p_data->'exercises', '[]')) loop
    select id into v_id from public.exercises
      where lower(name) = lower(trim(r->>'name')) and (user_id is null or user_id = v_uid)
      order by user_id nulls first limit 1;
    if v_id is null then
      insert into public.exercises (user_id, name, muscle_group, equipment)
        values (v_uid, trim(r->>'name'), r->>'muscle_group', r->>'equipment')
        returning id into v_id;
    end if;
    ex_map := ex_map || jsonb_build_object(r->>'id', v_id);
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_data->'foods', '[]')) loop
    select id into v_id from public.foods
      where lower(name) = lower(trim(r->>'name')) and (user_id is null or user_id = v_uid)
      order by user_id nulls first limit 1;
    if v_id is null then
      insert into public.foods (user_id, name, serving_label, serving_grams, calories_100g,
                                protein_100g, carbs_100g, fat_100g, is_vegetarian, source)
        values (v_uid, trim(r->>'name'), r->>'serving_label', (r->>'serving_grams')::numeric,
                (r->>'calories_100g')::numeric, (r->>'protein_100g')::numeric,
                (r->>'carbs_100g')::numeric, (r->>'fat_100g')::numeric,
                coalesce((r->>'is_vegetarian')::int, 1) = 1, 'custom')
        returning id into v_id;
    end if;
    food_map := food_map || jsonb_build_object(r->>'id', v_id);
  end loop;

  -- Splits. An imported active plan stays active only if the account has none yet.
  select exists (select 1 from public.split_plans where user_id = v_uid and is_active) into v_has_active_plan;
  for r in select * from jsonb_array_elements(coalesce(p_data->'split_plans', '[]')) loop
    insert into public.split_plans (name, inputs, is_active, created_at)
      values (r->>'name', coalesce((r->>'inputs_json')::jsonb, '{}'),
              (r->>'is_active')::int = 1 and not v_has_active_plan,
              coalesce((r->>'created_at')::timestamptz, now()))
      returning id into v_id;
    plan_map := plan_map || jsonb_build_object(r->>'id', v_id);
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_data->'split_days', '[]')) loop
    insert into public.split_days (plan_id, day_index, weekday, title)
      values ((plan_map->>(r->>'plan_id'))::bigint, (r->>'day_index')::int,
              (r->>'weekday')::int, r->>'title')
      returning id into v_id;
    day_map := day_map || jsonb_build_object(r->>'id', v_id);
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_data->'split_day_exercises', '[]')) loop
    insert into public.split_day_exercises (split_day_id, position, exercise_id, sets, reps_min, reps_max, rest_sec)
      values ((day_map->>(r->>'split_day_id'))::bigint, (r->>'position')::int,
              (ex_map->>(r->>'exercise_id'))::bigint, (r->>'sets')::int,
              (r->>'reps_min')::int, (r->>'reps_max')::int, (r->>'rest_sec')::int);
  end loop;

  -- Workouts. Ones without sets are skipped (the app discards those anyway). An
  -- unfinished workout stays in progress unless the account already has one, in which
  -- case it is closed at its last set.
  select exists (select 1 from public.workouts where user_id = v_uid and finished_at is null) into v_has_active_workout;
  -- local workout id -> time of its last set; workouts missing here have no sets
  select coalesce(jsonb_object_agg(wid, last_at), '{}') into last_set_at from (
    select we->>'workout_id' as wid, max((s->>'logged_at')::timestamptz) as last_at
    from jsonb_array_elements(coalesce(p_data->'workout_exercises', '[]')) we
    join jsonb_array_elements(coalesce(p_data->'workout_sets', '[]')) s
      on s->>'workout_exercise_id' = we->>'id'
    group by 1) x;
  for r in select * from jsonb_array_elements(coalesce(p_data->'workouts', '[]')) loop
    continue when not last_set_at ? (r->>'id');
    v_finished := (r->>'finished_at')::timestamptz;
    if v_finished is null and v_has_active_workout then
      v_finished := (last_set_at->>(r->>'id'))::timestamptz;
    end if;
    v_has_active_workout := v_has_active_workout or v_finished is null;
    insert into public.workouts (performed_on, started_at, finished_at, split_day_id)
      values ((r->>'performed_on')::date, (r->>'started_at')::timestamptz, v_finished,
              (day_map->>(r->>'split_day_id'))::bigint)
      returning id into v_id;
    workout_map := workout_map || jsonb_build_object(r->>'id', v_id);
    n_workouts := n_workouts + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_data->'workout_exercises', '[]')) loop
    continue when not workout_map ? (r->>'workout_id');
    insert into public.workout_exercises (workout_id, exercise_id, position, target_sets, target_reps_min, target_reps_max)
      values ((workout_map->>(r->>'workout_id'))::bigint, (ex_map->>(r->>'exercise_id'))::bigint,
              (r->>'position')::int, (r->>'target_sets')::int,
              (r->>'target_reps_min')::int, (r->>'target_reps_max')::int)
      returning id into v_id;
    we_map := we_map || jsonb_build_object(r->>'id', v_id);
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_data->'workout_sets', '[]')) loop
    continue when not we_map ? (r->>'workout_exercise_id');
    insert into public.workout_sets (workout_exercise_id, set_number, reps, weight_kg, logged_at)
      values ((we_map->>(r->>'workout_exercise_id'))::bigint, (r->>'set_number')::int,
              (r->>'reps')::int, (r->>'weight_kg')::numeric, (r->>'logged_at')::timestamptz);
    n_sets := n_sets + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_data->'water_logs', '[]')) loop
    insert into public.water_logs (logged_on, logged_at, amount_ml)
      values ((r->>'logged_on')::date, (r->>'logged_at')::timestamptz, (r->>'amount_ml')::int);
    n_water := n_water + 1;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_data->'food_logs', '[]')) loop
    insert into public.food_logs (logged_on, logged_at, meal, food_id, food_name, grams, calories, protein, carbs, fat)
      values ((r->>'logged_on')::date, (r->>'logged_at')::timestamptz, r->>'meal',
              (food_map->>(r->>'food_id'))::bigint, r->>'food_name', (r->>'grams')::numeric,
              (r->>'calories')::numeric, (r->>'protein')::numeric,
              (r->>'carbs')::numeric, (r->>'fat')::numeric);
    n_food := n_food + 1;
  end loop;

  return jsonb_build_object('workouts', n_workouts, 'sets', n_sets, 'food_logs', n_food, 'water_logs', n_water);
end $$;

revoke execute on function public.import_local_data(jsonb) from public, anon;
grant execute on function public.import_local_data(jsonb) to authenticated;
