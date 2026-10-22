import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { weekdayName } from '@/lib/date';
import { formatReps, type SplitPlan } from '@/lib/split';
import { spacing } from '@/theme';

// Read-only view of a generated plan: the reasoning, then each training day.
export function PlanPreview({ plan }: { plan: SplitPlan }) {
  return (
    <View style={styles.wrap}>
      <AppText variant="title">{plan.name}</AppText>

      <Card>
        <AppText>Why this plan</AppText>
        {plan.notes.map((note) => (
          <AppText key={note} variant="caption" muted>
            • {note}
          </AppText>
        ))}
      </Card>

      {plan.days.map((day) => (
        <Card key={`${day.weekday}-${day.title}`}>
          <AppText>
            {weekdayName(day.weekday)} · {day.title}
          </AppText>
          {day.exercises.map((ex) => (
            <View key={ex.name} style={styles.row}>
              <AppText variant="caption" muted style={styles.name}>
                {ex.name}
              </AppText>
              <AppText variant="caption" muted>
                {ex.sets} × {formatReps(ex)}
              </AppText>
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  name: {
    flex: 1,
  },
});
