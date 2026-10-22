import { router } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextLink } from '@/components/TextLink';
import { deleteFoodLog } from '@/db/foodLogs';
import { MacroSummary } from '@/features/macros/MacroSummary';
import { MealSection } from '@/features/macros/MealSection';
import { useMacroDay } from '@/features/macros/useMacroDay';
import { MealPlannerCard } from '@/features/mealPlan/MealPlannerCard';
import { formatDateKey, toDateKey } from '@/lib/date';
import { MEAL_OPTIONS } from '@/lib/macros';

export default function MealsScreen() {
  const { db, data, reload } = useMacroDay();

  return (
    <Screen title="Meals" subtitle={formatDateKey(data?.dateKey ?? toDateKey())}>
      {data ? <MacroSummary targets={data.targets} totals={data.totals} /> : null}

      <Button label="Log food" onPress={() => router.push('/food-search')} />

      {data && data.logs.length === 0 ? <AppText muted>Nothing logged yet today.</AppText> : null}

      {data
        ? MEAL_OPTIONS.map(({ value, label }) => {
            const entries = data.logs.filter((l) => l.meal === value);
            if (entries.length === 0) return null;
            return (
              <MealSection
                key={value}
                label={label}
                entries={entries}
                onDelete={async (id) => {
                  await deleteFoodLog(db, id);
                  await reload();
                }}
              />
            );
          })
        : null}

      {data?.targets ? (
        <TextLink label="Edit targets" onPress={() => router.push('/macro-targets')} />
      ) : null}

      {data ? <MealPlannerCard hasTargets={data.targets !== null} /> : null}
    </Screen>
  );
}
