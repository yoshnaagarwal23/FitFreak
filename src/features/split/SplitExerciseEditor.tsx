import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Stepper } from '@/components/Stepper';
import type { SavedSplitExercise } from '@/db/splits';
import { adjustTarget, TARGET_LIMITS, type Target, type TargetField } from '@/lib/split';
import { colors, layout, radius, spacing } from '@/theme';

type Props = {
  exercise: SavedSplitExercise;
  isFirst: boolean;
  isLast: boolean;
  onChangeTarget: (target: Target) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

const FIELDS: { field: TargetField; label: string }[] = [
  { field: 'sets', label: 'Sets' },
  { field: 'repsMin', label: 'Min reps' },
  { field: 'repsMax', label: 'Max reps' },
];

// One exercise on a split day: reorder/remove controls plus sets and rep-range steppers.
export function SplitExerciseEditor({ exercise, isFirst, isLast, onChangeTarget, onMove, onRemove }: Props) {
  const target: Target = { sets: exercise.sets, repsMin: exercise.repsMin, repsMax: exercise.repsMax };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AppText style={styles.name}>{exercise.name}</AppText>
        <IconButton symbol="↑" label={`Move ${exercise.name} up`} onPress={() => onMove(-1)} disabled={isFirst} />
        <IconButton symbol="↓" label={`Move ${exercise.name} down`} onPress={() => onMove(1)} disabled={isLast} />
        <IconButton symbol="×" label={`Remove ${exercise.name}`} onPress={onRemove} />
      </View>
      <View style={styles.steppers}>
        {FIELDS.map(({ field, label }) => (
          <Stepper
            key={field}
            label={label}
            value={target[field]}
            onChange={(delta) => onChangeTarget(adjustTarget(target, field, delta))}
            canDecrease={target[field] > TARGET_LIMITS[field].min}
            canIncrease={target[field] < TARGET_LIMITS[field].max}
          />
        ))}
      </View>
    </Card>
  );
}

function IconButton({
  symbol,
  label,
  onPress,
  disabled = false,
}: {
  symbol: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.icon, pressed && styles.pressed, disabled && styles.disabled]}>
      <AppText muted>{symbol}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    flex: 1,
  },
  steppers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  icon: {
    width: layout.iconButtonSize,
    height: layout.iconButtonSize,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.3,
  },
});
