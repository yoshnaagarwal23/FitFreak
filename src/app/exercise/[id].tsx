import { Stack, useLocalSearchParams } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { LineChart } from '@/components/LineChart';
import { Screen } from '@/components/Screen';
import { getExercise, getExerciseHistory } from '@/db/exercises';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { formatDateKey, formatShortDate } from '@/lib/date';
import { useUnits } from '@/features/settings/UnitsProvider';
import { formatMass } from '@/lib/units';
import { formatSet, groupSessions, volume } from '@/lib/workout';
import { spacing } from '@/theme';

export default function ExerciseHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = Number(id);

  const query = useCallback(
    async (db: SQLiteDatabase) => {
      const [exercise, rows] = await Promise.all([
        getExercise(db, exerciseId),
        getExerciseHistory(db, exerciseId),
      ]);
      return { exercise, sessions: groupSessions(rows) };
    },
    [exerciseId],
  );
  const { data } = useFocusQuery(query);
  const { units } = useUnits();
  const formatKg = (kg: number) => formatMass(kg, units);

  if (!data) return <Screen subtitle="Loading…" />;
  const { exercise, sessions } = data;
  if (!exercise) return <Screen subtitle="Exercise not found." />;

  // The chart only means something for loaded lifts; bodyweight-only sessions have no 1RM.
  const chartPoints = sessions
    .filter((s) => s.best1RM > 0)
    .map((s) => ({ label: formatShortDate(s.performedOn), value: s.best1RM }));

  return (
    <Screen subtitle={`${sessions.length} session${sessions.length === 1 ? '' : 's'}`}>
      <Stack.Screen options={{ title: exercise.name }} />

      {chartPoints.length >= 2 ? (
        <Card>
          <AppText>Estimated 1RM</AppText>
          <LineChart
            points={chartPoints}
            formatValue={formatKg}
            accessibilityLabel={`Estimated one-rep max over ${chartPoints.length} sessions`}
          />
        </Card>
      ) : sessions.length > 0 ? (
        <AppText muted>Log this exercise in two sessions to see a trend.</AppText>
      ) : (
        <AppText muted>No sets logged yet.</AppText>
      )}

      {[...sessions].reverse().map((s) => (
        <Card key={s.workoutId}>
          <View style={styles.sessionHeader}>
            <AppText>{formatDateKey(s.performedOn)}</AppText>
            {s.best1RM > 0 ? (
              <AppText variant="caption" muted>
                e1RM {formatKg(s.best1RM)}
              </AppText>
            ) : null}
          </View>
          <View style={styles.sets}>
            {s.sets.map((set, i) => (
              <AppText key={i} variant="caption" muted>
                Set {i + 1} · {formatSet(set, units)}
              </AppText>
            ))}
          </View>
          <AppText variant="caption" muted>
            Volume {formatKg(volume(s.sets))}
          </AppText>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sets: {
    gap: spacing.xs,
  },
});
