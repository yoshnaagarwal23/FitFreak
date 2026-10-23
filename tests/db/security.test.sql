-- Security and behaviour tests for the Supabase schema, run by scripts/test-db.sh.
-- Two users: alice uses the app normally; bob (and a logged-out visitor) try to reach
-- her data in every way the API allows. Any failed assertion aborts with an error.

create schema test;
grant usage on schema test to anon, authenticated;

create function test.eq(actual anyelement, expected anyelement, label text) returns void
  language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
  raise notice 'ok  %', label;
end $$;

-- Runs a statement that must fail with the given SQLSTATE.
create function test.fails(stmt text, expected_state text, label text) returns void
  language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL %: statement succeeded but should have failed', label;
exception
  when others then
    if sqlstate = expected_state then
      raise notice 'ok  % (blocked: %)', label, sqlerrm;
    else
      raise exception 'FAIL %: expected SQLSTATE %, got % (%)', label, expected_state, sqlstate, sqlerrm;
    end if;
end $$;

grant execute on all functions in schema test to anon, authenticated;

\set alice '''aaaaaaaa-0000-0000-0000-000000000001'''
\set bob   '''bbbbbbbb-0000-0000-0000-000000000002'''
insert into auth.users (id) values (:alice), (:bob);

-- ===================================================================== alice
set role authenticated;
select set_config('request.jwt.claim.sub', :alice, false) \gset

select test.eq((select count(*) from exercises), 43::bigint, 'alice sees 43 built-in exercises');
select test.eq((select count(*) from foods), 47::bigint, 'alice sees 47 built-in foods');

insert into exercises (user_id, name, muscle_group, equipment) values (auth.uid(), 'Zercher Squat', 'legs', 'barbell');
insert into foods (user_id, name, serving_label, serving_grams, calories_100g, protein_100g, carbs_100g, fat_100g, source)
  values (auth.uid(), 'Alice protein bar', '1 bar', 60, 427, 33, 40, 15, 'custom');
insert into user_settings (units, water_goal_glasses) values ('imperial', 10);
insert into water_logs (logged_on, amount_ml) values ('2026-10-22', 250), ('2026-10-22', 250);

select save_split('Upper / Lower', '{"daysPerWeek": 2}',
  '[{"weekday": 1, "title": "Upper A", "exercises": [
      {"name": "Bench Press", "sets": 3, "reps_min": 6, "reps_max": 10, "rest_sec": 120},
      {"name": "zercher squat", "sets": 3, "reps_min": 5, "reps_max": 8, "rest_sec": 120}]},
    {"weekday": 4, "title": "Lower A", "exercises": [
      {"name": "Back Squat", "sets": 3, "reps_min": 6, "reps_max": 10, "rest_sec": 120}]}]') as plan_id \gset
select test.eq((select count(*) from split_days where plan_id = :plan_id), 2::bigint, 'save_split creates days');
select test.eq((select e.name from split_day_exercises sde join exercises e on e.id = sde.exercise_id
                where sde.position = 1 and sde.split_day_id = (select min(id) from split_days)),
               'Zercher Squat', 'save_split resolves a custom exercise by name');
select save_split('Second plan', '{}', '[]') \gset
select test.eq((select count(*) from split_plans where is_active), 1::bigint, 'only one active plan');
update split_plans set is_active = false;
update split_plans set is_active = true where id = :plan_id;

select id as upper_day from split_days where title = 'Upper A' \gset
select start_workout_from_split_day(:upper_day, '2026-10-22') as wid \gset
select test.eq(start_workout('2026-10-22'), :wid::bigint, 'start_workout returns the active workout');
select test.eq((select count(*) from workout_exercises where workout_id = :wid), 2::bigint, 'split day exercises copied');
select test.eq((select target_reps_max from workout_exercises where workout_id = :wid and position = 1), 10, 'targets copied');

select id as we from workout_exercises where workout_id = :wid and position = 1 \gset
select add_set(:we, 8, 60) as set1 \gset
select add_set(:we, 8, 60) \gset
select add_set(:we, 6, 62.5) \gset
select delete_set(:set1);
select test.eq((select string_agg(set_number || ':' || weight_kg, ',' order by set_number) from workout_sets where workout_exercise_id = :we),
               '1:60,2:62.5', 'delete_set renumbers the rest');
select finish_workout(:wid);
select test.eq((select finished_at is not null from workouts where id = :wid), true, 'finish keeps a workout with sets');

select start_workout('2026-10-23') as empty_wid \gset
select finish_workout(:empty_wid);
select test.eq((select count(*) from workouts where id = :empty_wid), 0::bigint, 'finishing an empty workout deletes it');

select id as bar from foods where name = 'Alice protein bar' \gset
insert into food_logs (logged_on, meal, food_id, food_name, grams, calories, protein, carbs, fat)
  values ('2026-10-22', 'snack', :bar, 'Alice protein bar', 60, 256, 20, 24, 9);

select id as row_a from split_day_exercises where split_day_id = :upper_day and position = 0 \gset
select move_split_exercise(:row_a, 1);
select test.eq((select position from split_day_exercises where id = :row_a), 1, 'move_split_exercise swaps positions');
select add_exercise_to_split_day(:upper_day, (select id from exercises where name = 'Dips'));
select add_exercise_to_split_day(:upper_day, (select id from exercises where name = 'Dips'));
select test.eq((select count(*) from split_day_exercises where split_day_id = :upper_day), 3::bigint, 'add_exercise_to_split_day skips duplicates');

select test.fails($$ insert into foods (user_id, name, serving_label, serving_grams, calories_100g, protein_100g, carbs_100g, fat_100g, source)
                     values (auth.uid(), 'Fake USDA', '1', 1, 1, 1, 1, 1, 'usda') $$, '42501', 'users cannot add foods labelled as built-in sources');
select test.fails($$ insert into exercises (name, muscle_group, equipment) values ('New built-in', 'legs', 'barbell') $$,
                  '42501', 'users cannot add built-in exercises');
select test.fails($$ insert into ai_usage (user_id, kind) values (auth.uid(), 'meal_plan') $$, '42501', 'users cannot write AI usage');
select test.fails($$ insert into workout_sets (workout_exercise_id, set_number, reps, weight_kg) values ($$ || :we || $$, 9, 0, 50) $$,
                  '23514', 'check constraints still apply (reps >= 1)');

-- ===================================================================== bob
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :bob, false) \gset

select test.eq((select count(*) from exercises), 43::bigint, 'bob sees built-ins but not alice''s custom exercise');
select test.eq((select count(*) from foods), 47::bigint, 'bob does not see alice''s custom food');
select test.eq((select count(*) from workouts), 0::bigint, 'bob sees none of alice''s workouts');
select test.eq((select count(*) from workout_sets), 0::bigint, 'bob sees none of alice''s sets');
select test.eq((select count(*) from split_plans), 0::bigint, 'bob sees none of alice''s plans');
select test.eq((select count(*) from water_logs), 0::bigint, 'bob sees none of alice''s water');
select test.eq((select count(*) from food_logs), 0::bigint, 'bob sees none of alice''s food log');
select test.eq((select count(*) from user_settings), 0::bigint, 'bob cannot read alice''s settings');

with u as (update workouts set finished_at = null where id = :wid returning 1) select test.eq((select count(*) from u), 0::bigint, 'bob cannot update alice''s workout');
with d as (delete from water_logs returning 1) select test.eq((select count(*) from d), 0::bigint, 'bob cannot delete alice''s water');
select delete_set((select min(id) from workout_sets));
select test.eq((select 1), 1, 'bob calling delete_set on hidden ids is a no-op');

select start_workout('2026-10-22') as bob_wid \gset
select test.fails($$ insert into workout_sets (workout_exercise_id, set_number, reps, weight_kg) values ($$ || :we || $$, 9, 5, 100) $$,
                  '42501', 'bob cannot add a set to alice''s exercise');
select test.fails($$ select add_set($$ || :we || $$, 5, 100) $$, '42501', 'bob cannot add_set to alice''s exercise via RPC');
reset role;
select id as zercher from exercises where name = 'Zercher Squat' \gset
set role authenticated;
select set_config('request.jwt.claim.sub', :bob, false) \gset
select test.fails(format($$ insert into workout_exercises (workout_id, exercise_id, position) values (%s, %s, 1) $$, :bob_wid, :zercher),
                  '42501', 'bob cannot use alice''s custom exercise even with its id');
select test.fails(format($$ insert into workout_exercises (workout_id, exercise_id, position) values (%s, (select id from public.exercises where name = 'Bench Press'), 1) $$, :wid),
                  '42501', 'bob cannot add exercises to alice''s workout');
select test.fails(format($$ insert into split_days (plan_id, day_index, weekday, title) values (%s, 9, 1, 'Hijack') $$, :plan_id),
                  '42501', 'bob cannot add days to alice''s plan');
select finish_workout(:bob_wid);  -- no active workout, so the call below must create one
select test.fails(format($$ select start_workout_from_split_day(%s, '2026-10-22') $$, :upper_day),
                  '42501', 'bob cannot start a workout from alice''s split day');
select test.fails(format($$ insert into food_logs (logged_on, meal, food_id, food_name, grams, calories, protein, carbs, fat) values ('2026-10-22', 'lunch', %s, 'x', 1, 1, 1, 1, 1) $$, :bar),
                  '42501', 'bob cannot log alice''s custom food');
select test.fails($$ insert into water_logs (user_id, logged_on, amount_ml) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-22', 250) $$,
                  '42501', 'bob cannot write rows as alice');

-- ===================================================================== logged out
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false) \gset
select test.eq((select count(*) from exercises), 43::bigint, 'visitors see built-in exercises');
select test.eq((select count(*) from workouts), 0::bigint, 'visitors see no workouts');
select test.fails($$ select start_workout('2026-10-22') $$, '42501', 'visitors cannot call app functions');
select test.fails($$ insert into water_logs (logged_on, amount_ml) values ('2026-10-22', 250) $$, '42501', 'visitors cannot write');

-- ===================================================================== account deletion
reset role;
delete from auth.users where id = :alice;
select test.eq((select count(*) from workouts where user_id = :alice), 0::bigint, 'deleting a user removes their workouts');
select test.eq((select count(*) from exercises), 43::bigint, 'and their custom exercises, leaving built-ins');

\echo 'ALL DATABASE SECURITY TESTS PASSED'
