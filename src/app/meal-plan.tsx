import { useDb } from '@/db/supabase';
import { useEffect, useState } from 'react';

import { ApiError } from '@/api/client';
import { requestMealPlan } from '@/api/mealPlan';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { OptionGroup } from '@/components/OptionGroup';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { getAllFoods, type Food } from '@/db/foods';
import { getLastPlan, logPlannedMeal, saveLastPlan } from '@/db/mealPlans';
import { useMacroDay } from '@/features/macros/useMacroDay';
import { PlannedMealCard } from '@/features/mealPlan/PlannedMealCard';
import { PlanTotals } from '@/features/mealPlan/PlanTotals';
import { MEAL_OPTIONS, type Meal } from '@/lib/macros';
import {
  buildPlanRequest,
  defaultMeals,
  MIN_PLAN_CALORIES,
  parseMealPlan,
  remainingTargets,
  type MealPlan,
  type PlanScope,
} from '@/lib/mealPlan';

const SCOPE_OPTIONS: { value: PlanScope; label: string }[] = [
  { value: 'day', label: 'Whole day' },
  { value: 'remaining', label: "What's left today" },
];

const YES_NO = [
  { value: 'yes' as const, label: 'Yes' },
  { value: 'no' as const, label: 'No' },
];

type Result = { raw: unknown; plan: MealPlan; logged: Meal[] };

export default function MealPlanScreen() {
  const db = useDb();
  const { data: day } = useMacroDay();
  const [foods, setFoods] = useState<Food[]>([]);
  const [scope, setScope] = useState<PlanScope>('day');
  const [meals, setMeals] = useState<Meal[]>(defaultMeals('day', []));
  const [vegetarian, setVegetarian] = useState(true);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // Load the food list and today's last plan, if any.
  useEffect(() => {
    getAllFoods(db).then(async (all) => {
      setFoods(all);
      const last = await getLastPlan(db, new Set(all.map((f) => f.id)));
      if (last && day && last.dateKey === day.dateKey) setResult(last);
    });
  }, [db, day]);

  if (!day) return <Screen subtitle="Loading…" />;
  if (!day.targets) return <Screen subtitle="Set your macro targets on the Meals tab first." />;
  const targets = day.targets;

  const loggedMeals = [...new Set(day.logs.map((l) => l.meal))];
  const planTargets = scope === 'day' ? targets : remainingTargets(targets, day.totals);

  const changeScope = (next: PlanScope) => {
    setScope(next);
    setMeals(defaultMeals(next, loggedMeals));
  };

  const toggleMeal = (m: Meal) => setMeals((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  const generate = async () => {
    if (meals.length === 0) return setError('Pick at least one meal.');
    if (planTargets.calories < MIN_PLAN_CALORIES) {
      return setError(`Only ${planTargets.calories} kcal left today — not enough to plan a meal.`);
    }
    setError(null);
    setLoading(true);
    try {
      const usable = vegetarian ? foods.filter((f) => f.vegetarian) : foods;
      const raw = await requestMealPlan(buildPlanRequest({ targets: planTargets, foods: usable, meals, vegetarian, notes }));
      const parsed = parseMealPlan(raw, new Set(foods.map((f) => f.id)));
      if (!parsed.ok) return setError(parsed.error);
      setResult({ raw, plan: parsed.value, logged: [] });
      await saveLastPlan(db, day.dateKey, raw);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const logMeal = async (meal: Meal) => {
    if (!result) return;
    const planned = result.plan.meals.find((m) => m.meal === meal);
    if (!planned) return;
    await logPlannedMeal(db, planned.items, meal);
    const logged = [...result.logged, meal];
    setResult({ ...result, logged });
    await saveLastPlan(db, day.dateKey, result.raw, logged);
  };

  return (
    <Screen>
      <OptionGroup label="Plan for" options={SCOPE_OPTIONS} isSelected={(v) => v === scope} onPress={changeScope} />
      <AppText variant="caption" muted>
        Aiming for {planTargets.calories} kcal · P {planTargets.protein} g · C {planTargets.carbs} g · F{' '}
        {planTargets.fat} g
      </AppText>
      <OptionGroup label="Meals" options={MEAL_OPTIONS} isSelected={(v) => meals.includes(v)} onPress={toggleMeal} multiple />
      <OptionGroup
        label="Vegetarian"
        options={YES_NO}
        isSelected={(v) => v === (vegetarian ? 'yes' : 'no')}
        onPress={(v) => setVegetarian(v === 'yes')}
      />
      <TextField
        label="Anything else? (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. no onion or garlic, high-protein breakfast"
        maxLength={300}
      />

      <Button label={loading ? 'Planning… this can take a minute' : 'Plan my meals'} onPress={generate} disabled={loading} />
      {error ? <AppText variant="caption">{error}</AppText> : null}

      {result ? (
        <>
          <PlanTotals plan={result.plan} />
          {result.plan.meals.map((m) => (
            <PlannedMealCard
              key={m.meal}
              meal={m}
              logged={result.logged.includes(m.meal)}
              onLog={() => logMeal(m.meal)}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
