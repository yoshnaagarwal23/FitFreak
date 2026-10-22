import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { formatDeviation, type MealPlan } from '@/lib/mealPlan';
import { spacing } from '@/theme';

const ROWS = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
] as const;

// Plan totals vs. targets. Numbers are computed by the server from the app's food data, not by the AI.
export function PlanTotals({ plan }: { plan: MealPlan }) {
  return (
    <Card style={styles.card}>
      <AppText>{plan.withinTolerance ? 'Plan fits your targets' : 'Closest plan found'}</AppText>
      {ROWS.map(({ key, label, unit }) => (
        <View key={key} style={styles.row}>
          <AppText variant="caption" muted>
            {label}
          </AppText>
          <AppText variant="caption">
            {Math.round(plan.totals[key])} / {Math.round(plan.targets[key])} {unit} ·{' '}
            {formatDeviation(plan.deviation[key])}
          </AppText>
        </View>
      ))}
      {plan.notes ? (
        <AppText variant="caption" muted>
          {plan.notes}
        </AppText>
      ) : null}
      {!plan.withinTolerance ? (
        <AppText variant="caption" muted>
          Not every macro is within range (±10% calories/protein, ±20% carbs/fat). Try again, or add foods.
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
