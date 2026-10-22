import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import type { WorkoutExercise } from '@/db/workouts';
import { formatReps } from '@/lib/split';
import { useUnits } from '@/features/settings/UnitsProvider';
import { kgToUserMass, massUnit } from '@/lib/units';
import { formatSet, parseSetInput, type SetEntry } from '@/lib/workout';
import { colors, layout, radius, spacing } from '@/theme';

type Props = {
  exercise: WorkoutExercise;
  onAddSet: (set: SetEntry) => Promise<void>;
  onDeleteSet: (setId: number) => Promise<void>;
  onRemove: () => Promise<void>;
};

// One exercise inside a workout: its logged sets plus an entry row for the next set.
export function ExerciseBlock({ exercise, onAddSet, onDeleteSet, onRemove }: Props) {
  const { units } = useUnits();
  // Prefill with the last set logged for this exercise (here or in a past workout), in the user's units.
  const [weight, setWeight] = useState(
    exercise.lastSet ? String(kgToUserMass(exercise.lastSet.weightKg, units)) : '',
  );
  const [reps, setReps] = useState(
    exercise.lastSet
      ? String(exercise.lastSet.reps)
      : exercise.target
        ? String(exercise.target.repsMin)
        : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsed = parseSetInput(weight, reps, units);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onAddSet(parsed.set);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.title}>
          <AppText>{exercise.name}</AppText>
          {exercise.target ? (
            <AppText variant="caption" muted>
              Target {exercise.target.sets} × {formatReps(exercise.target)}
              {' · '}
              {exercise.sets.length}/{exercise.target.sets} done
            </AppText>
          ) : null}
        </View>
        {exercise.sets.length === 0 ? (
          <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={spacing.sm}>
            <AppText variant="caption" muted>
              Remove
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {exercise.sets.map((s) => (
        <View key={s.id} style={styles.setRow}>
          <AppText variant="caption" muted style={styles.setNumber}>
            Set {s.setNumber}
          </AppText>
          <AppText style={styles.setValue}>{formatSet(s, units)}</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete set ${s.setNumber}`}
            onPress={() => onDeleteSet(s.id)}
            style={styles.deleteButton}>
            <AppText muted>×</AppText>
          </Pressable>
        </View>
      ))}

      <View style={styles.entry}>
        <TextField
          label={massUnit(units)}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          placeholder="0"
          style={styles.input}
        />
        <TextField
          label="Reps"
          value={reps}
          onChangeText={setReps}
          keyboardType="number-pad"
          placeholder="0"
          style={styles.input}
          onSubmitEditing={submit}
        />
        <Button label="Add set" onPress={submit} disabled={saving} />
      </View>
      {error ? <AppText variant="caption">{error}</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    flex: 1,
    gap: spacing.xs,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  setNumber: {
    width: spacing.xxl,
  },
  setValue: {
    flex: 1,
  },
  deleteButton: {
    width: layout.iconButtonSize,
    height: layout.iconButtonSize,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    flex: 1,
  },
});
