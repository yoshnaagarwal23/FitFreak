-- Multi-step operations as database functions, so each runs atomically in one round trip.
-- All are SECURITY INVOKER (the default): they run as the calling user, so row-level
-- security still applies to every statement inside them.

-- Returns the in-progress workout if there is one; otherwise starts a new one.
create function public.start_workout(p_local_date date) returns bigint
  language plpgsql set search_path = '' as $$
declare
  v_id bigint;
begin
  select id into v_id from public.workouts where user_id = auth.uid() and finished_at is null;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.workouts (performed_on) values (p_local_date) returning id into v_id;
  return v_id;
end $$;

-- Starts a workout pre-filled with a split day's exercises and targets.
-- Returns the in-progress workout instead if one exists.
create function public.start_workout_from_split_day(p_split_day_id bigint, p_local_date date) returns bigint
  language plpgsql set search_path = '' as $$
declare
  v_id bigint;
begin
  select id into v_id from public.workouts where user_id = auth.uid() and finished_at is null;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.workouts (performed_on, split_day_id) values (p_local_date, p_split_day_id)
    returning id into v_id;
  insert into public.workout_exercises (workout_id, exercise_id, position, target_sets, target_reps_min, target_reps_max)
    select v_id, exercise_id, position + 1, sets, reps_min, reps_max
    from public.split_day_exercises where split_day_id = p_split_day_id
    order by position;
  return v_id;
end $$;

-- Finishing a workout with no sets discards it.
create function public.finish_workout(p_workout_id bigint) returns void
  language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.workout_sets s
    join public.workout_exercises we on we.id = s.workout_exercise_id
    where we.workout_id = p_workout_id
  ) then
    update public.workouts set finished_at = now() where id = p_workout_id;
  else
    delete from public.workouts where id = p_workout_id;
  end if;
end $$;

create function public.add_exercise_to_workout(p_workout_id bigint, p_exercise_id bigint) returns void
  language sql set search_path = '' as $$
  insert into public.workout_exercises (workout_id, exercise_id, position)
  select p_workout_id, p_exercise_id, coalesce(max(position), 0) + 1
  from public.workout_exercises where workout_id = p_workout_id
  on conflict (workout_id, exercise_id) do nothing;
$$;

-- Appends a set, numbering it after the exercise's existing sets.
create function public.add_set(p_workout_exercise_id bigint, p_reps int, p_weight_kg numeric) returns bigint
  language plpgsql set search_path = '' as $$
declare
  v_id bigint;
begin
  -- Lock the parent row so two quick taps can't produce the same set number.
  perform 1 from public.workout_exercises where id = p_workout_exercise_id for update;
  insert into public.workout_sets (workout_exercise_id, set_number, reps, weight_kg)
  select p_workout_exercise_id, count(*) + 1, p_reps, p_weight_kg
  from public.workout_sets where workout_exercise_id = p_workout_exercise_id
  returning id into v_id;
  return v_id;
end $$;

-- Deletes a set and renumbers the remaining sets of that exercise 1..n.
create function public.delete_set(p_set_id bigint) returns void
  language plpgsql set search_path = '' as $$
declare
  v_we bigint;
begin
  delete from public.workout_sets where id = p_set_id returning workout_exercise_id into v_we;
  if v_we is null then
    return;
  end if;
  update public.workout_sets s set set_number = r.n
  from (
    select id, row_number() over (order by set_number, id) as n
    from public.workout_sets where workout_exercise_id = v_we
  ) r
  where s.id = r.id;
end $$;

-- Saves a generated plan and makes it the active one. Older plans stay (inactive)
-- because past workouts reference their days.
-- p_days: [{ "weekday": 1, "title": "Upper A",
--            "exercises": [{ "name": "Bench Press", "sets": 3, "reps_min": 6, "reps_max": 10, "rest_sec": 120 }] }]
create function public.save_split(p_name text, p_inputs jsonb, p_days jsonb) returns bigint
  language plpgsql set search_path = '' as $$
declare
  v_plan bigint;
  v_day bigint;
  v_exercise bigint;
  d jsonb;
  e jsonb;
  d_index int := 0;
  e_index int;
begin
  update public.split_plans set is_active = false where user_id = auth.uid() and is_active;
  insert into public.split_plans (name, inputs, is_active) values (p_name, p_inputs, true)
    returning id into v_plan;

  for d in select * from jsonb_array_elements(p_days) loop
    insert into public.split_days (plan_id, day_index, weekday, title)
      values (v_plan, d_index, (d->>'weekday')::int, d->>'title')
      returning id into v_day;
    d_index := d_index + 1;
    e_index := 0;

    for e in select * from jsonb_array_elements(d->'exercises') loop
      -- Built-in exercise first, then the user's own custom one with that name.
      select id into v_exercise from public.exercises
        where lower(name) = lower(e->>'name') and (user_id is null or user_id = auth.uid())
        order by user_id nulls first
        limit 1;
      if v_exercise is null then
        raise exception 'Exercise "%" is missing from the library', e->>'name';
      end if;
      insert into public.split_day_exercises (split_day_id, position, exercise_id, sets, reps_min, reps_max, rest_sec)
        values (v_day, e_index, v_exercise, (e->>'sets')::int, (e->>'reps_min')::int,
                (e->>'reps_max')::int, (e->>'rest_sec')::int);
      e_index := e_index + 1;
    end loop;
  end loop;

  return v_plan;
end $$;

create function public.add_split_day(p_plan_id bigint, p_weekday int) returns bigint
  language sql set search_path = '' as $$
  insert into public.split_days (plan_id, day_index, weekday, title)
  select p_plan_id, coalesce(max(day_index), -1) + 1, p_weekday, 'Custom'
  from public.split_days where plan_id = p_plan_id
  returning id;
$$;

-- Adds an exercise to a split day with default targets; no-op if it's already there.
create function public.add_exercise_to_split_day(p_split_day_id bigint, p_exercise_id bigint) returns void
  language sql set search_path = '' as $$
  insert into public.split_day_exercises (split_day_id, position, exercise_id, sets, reps_min, reps_max, rest_sec)
  select p_split_day_id, coalesce(max(position), -1) + 1, p_exercise_id, 3, 8, 12, 90
  from public.split_day_exercises where split_day_id = p_split_day_id
  having not exists (
    select 1 from public.split_day_exercises where split_day_id = p_split_day_id and exercise_id = p_exercise_id
  );
$$;

-- Swaps an exercise with its neighbour (direction -1 = up, +1 = down).
create function public.move_split_exercise(p_row_id bigint, p_direction int) returns void
  language plpgsql set search_path = '' as $$
declare
  v_day bigint;
  v_pos int;
  v_other bigint;
  v_other_pos int;
begin
  select split_day_id, position into v_day, v_pos from public.split_day_exercises where id = p_row_id;
  if v_day is null then
    return;
  end if;
  if p_direction < 0 then
    select id, position into v_other, v_other_pos from public.split_day_exercises
      where split_day_id = v_day and position < v_pos order by position desc limit 1;
  else
    select id, position into v_other, v_other_pos from public.split_day_exercises
      where split_day_id = v_day and position > v_pos order by position asc limit 1;
  end if;
  if v_other is null then
    return;
  end if;
  update public.split_day_exercises set position = v_other_pos where id = p_row_id;
  update public.split_day_exercises set position = v_pos where id = v_other;
end $$;

-- Only signed-in users may call these.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.start_workout(date),
  public.start_workout_from_split_day(bigint, date),
  public.finish_workout(bigint),
  public.add_exercise_to_workout(bigint, bigint),
  public.add_set(bigint, int, numeric),
  public.delete_set(bigint),
  public.save_split(text, jsonb, jsonb),
  public.add_split_day(bigint, int),
  public.add_exercise_to_split_day(bigint, bigint),
  public.move_split_exercise(bigint, int),
  public.owns_workout(bigint), public.owns_workout_exercise(bigint),
  public.owns_split_plan(bigint), public.owns_split_day(bigint),
  public.can_use_exercise(bigint), public.can_use_food(bigint)
  to authenticated;
