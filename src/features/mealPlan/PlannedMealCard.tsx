import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useUnits } from '@/features/settings/UnitsProvider';
import { MEAL_OPTIONS } from '@/lib/macros';
import { formatFoodMass } from '@/lib/units';
import type { PlanMeal } from '@/lib/mealPlan';
import { spacing } from '@/theme';

type Props = {
  meal: PlanMeal;
  logged: boolean;
  onLog: () => Promise<void>;
};

// One AI-planned meal: dish, ingredients with portions, how to make it, and a log button.
export function PlannedMealCard({ meal, logged, onLog }: Props) {
  const [saving, setSaving] = useState(false);
  const { units } = useUnits();
  const label = MEAL_OPTIONS.find((m) => m.value === meal.meal)?.label ?? meal.meal;
  const t = meal.totals;

  const log = async () => {
    setSaving(true);
    try {
      await onLog();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={styles.card}>
      <AppText variant="caption" muted>
        {label.toUpperCase()} · {Math.round(t.calories)} KCAL
      </AppText>
      <AppText>{meal.name}</AppText>

      <View style={styles.items}>
        {meal.items.map((it) => (
          <AppText key={`${it.foodId}-${it.grams}`} variant="caption" muted>
            • {it.foodName} · {formatFoodMass(it.grams, units)} · {Math.round(it.macros.calories)} kcal
          </AppText>
        ))}
      </View>

      {meal.instructions ? <AppText variant="caption">{meal.instructions}</AppText> : null}

      <AppText variant="caption" muted>
        P {Math.round(t.protein)} g · C {Math.round(t.carbs)} g · F {Math.round(t.fat)} g
      </AppText>

      <View style={styles.action}>
        <Button
          label={logged ? 'Logged ✓' : `Log to ${label.toLowerCase()}`}
          variant={logged ? 'secondary' : 'primary'}
          onPress={log}
          disabled={logged || saving}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  items: {
    gap: spacing.xs,
  },
  action: {
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
});
