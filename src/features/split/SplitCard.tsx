import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { TextLink } from '@/components/TextLink';
import type { SavedSplit } from '@/db/splits';
import { isoWeekday, weekdayName } from '@/lib/date';
import { spacing } from '@/theme';

type Props = {
  split: SavedSplit | null;
  onStartDay: (splitDayId: number) => void;
  disabled?: boolean;
};

// Workouts tab section: the active split's days, each startable as a workout.
export function SplitCard({ split, onStartDay, disabled }: Props) {
  if (!split) {
    return (
      <Card>
        <AppText>No split yet</AppText>
        <AppText variant="caption" muted>
          Build a weekly plan from your goal, schedule, and equipment.
        </AppText>
        <View style={styles.action}>
          <Button label="Build a split" variant="secondary" onPress={() => router.push('/split')} />
        </View>
      </Card>
    );
  }

  const today = isoWeekday();

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <AppText variant="caption" muted>
          YOUR SPLIT · {split.name.toUpperCase()}
        </AppText>
        <TextLink label="Edit" accessibilityLabel="Edit split" onPress={() => router.push('/split-edit')} />
      </View>
      {split.days.map((day) => (
        <ListRow
          key={day.id}
          title={`${weekdayName(day.weekday)} · ${day.title}`}
          detail={day.exercises.map((e) => e.name).join(', ')}
          trailing={day.weekday === today ? 'Today · Start' : 'Start'}
          accessibilityLabel={`Start ${day.title}`}
          onPress={() => onStartDay(day.id)}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  action: {
    marginTop: spacing.sm,
    alignItems: 'flex-start',
  },
});
