import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import type { Macros } from '@/lib/macros';
import { spacing } from '@/theme';

type Props = {
  targets: Macros | null;
  totals: Macros;
};

const MACRO_ROWS: { key: 'protein' | 'carbs' | 'fat'; label: string }[] = [
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'fat', label: 'Fat' },
];

// Today's calories and macros against targets.
export function MacroSummary({ targets, totals }: Props) {
  if (!targets) {
    return (
      <Card>
        <AppText>Macros</AppText>
        <AppText variant="caption" muted>
          Set daily targets to track protein, carbs, and fat.
        </AppText>
        <View style={styles.action}>
          <Button label="Set targets" variant="secondary" onPress={() => router.push('/macro-targets')} />
        </View>
      </Card>
    );
  }

  const left = Math.round(targets.calories - totals.calories);

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <AppText>Calories</AppText>
        <AppText variant="caption" muted>
          {Math.round(totals.calories)} / {targets.calories} kcal
        </AppText>
      </View>
      <ProgressBar value={totals.calories} max={targets.calories} accessibilityLabel="Calories" />
      <AppText variant="caption" muted>
        {left >= 0 ? `${left} kcal left` : `${-left} kcal over`}
      </AppText>

      {MACRO_ROWS.map(({ key, label }) => (
        <View key={key} style={styles.macro}>
          <View style={styles.row}>
            <AppText variant="caption">{label}</AppText>
            <AppText variant="caption" muted>
              {Math.round(totals[key])} / {Math.round(targets[key])} g
            </AppText>
          </View>
          <ProgressBar value={totals[key]} max={targets[key]} accessibilityLabel={label} />
        </View>
      ))}
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
    alignItems: 'center',
  },
  macro: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  action: {
    marginTop: spacing.sm,
    alignItems: 'flex-start',
  },
});
