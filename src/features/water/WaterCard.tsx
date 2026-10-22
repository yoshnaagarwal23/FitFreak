import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProgressRing } from '@/components/ProgressRing';
import { useUnits } from '@/features/settings/UnitsProvider';
import { formatVolume } from '@/lib/units';
import { glassesFromMl, MAX_GOAL_GLASSES, MIN_GOAL_GLASSES, progress } from '@/lib/water';
import { spacing } from '@/theme';

import { useWaterToday } from './useWaterToday';

export function WaterCard() {
  const { totalMl, goalGlasses, loaded, addGlass, undo, changeGoal } = useWaterToday();
  const glasses = glassesFromMl(totalMl);
  const { units } = useUnits();

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AppText>Water</AppText>
        <AppText variant="caption" muted>
          {formatVolume(totalMl, units)}
        </AppText>
      </View>

      <View style={styles.ring}>
        <ProgressRing progress={progress(totalMl, goalGlasses)}>
          <AppText variant="title">{glasses}</AppText>
          <AppText variant="caption" muted>
            of {goalGlasses} glasses
          </AppText>
        </ProgressRing>
      </View>

      <View style={styles.actions}>
        <Button label="Undo" variant="secondary" onPress={undo} disabled={!loaded || totalMl === 0} />
        <Button label="+ Glass" onPress={addGlass} disabled={!loaded} />
      </View>

      <View style={styles.goalRow}>
        <AppText variant="caption" muted>
          Daily goal
        </AppText>
        <View style={styles.stepper}>
          <Button
            label="−"
            variant="secondary"
            accessibilityLabel="Decrease goal"
            onPress={() => changeGoal(goalGlasses - 1)}
            disabled={!loaded || goalGlasses <= MIN_GOAL_GLASSES}
          />
          <AppText>{goalGlasses}</AppText>
          <Button
            label="+"
            variant="secondary"
            accessibilityLabel="Increase goal"
            onPress={() => changeGoal(goalGlasses + 1)}
            disabled={!loaded || goalGlasses >= MAX_GOAL_GLASSES}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ring: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
