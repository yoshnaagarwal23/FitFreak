import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import type { Db } from '@/db/client';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import {
  addSet,
  deleteSet,
  finishWorkout,
  getWorkoutDetail,
  removeExerciseFromWorkout,
} from '@/db/workouts';
import { ExerciseBlock } from '@/features/workouts/ExerciseBlock';
import { useUnits } from '@/features/settings/UnitsProvider';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { formatDateKey } from '@/lib/date';

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);

  const query = useCallback((db: Db) => getWorkoutDetail(db, workoutId), [workoutId]);
  const { db, data: workout, reload } = useFocusQuery(query);
  const { units } = useUnits();

  if (workout === undefined) return <Screen subtitle="Loading…" />;
  if (workout === null) return <Screen subtitle="This workout no longer exists." />;

  const active = workout.finishedAt === null;
  const setCount = workout.exercises.reduce((n, e) => n + e.sets.length, 0);

  const finish = async () => {
    await finishWorkout(db, workoutId);
    if (router.canGoBack()) router.back();
    else router.replace('/workouts');
  };

  return (
    <Screen
      subtitle={[
        formatDateKey(workout.performedOn),
        workout.splitDayTitle,
        active ? 'in progress' : null,
      ]
        .filter(Boolean)
        .join(' · ')}>
      <Stack.Screen options={{ title: active ? 'Workout' : 'Past workout' }} />

      {workout.exercises.length === 0 ? (
        <AppText muted>Add your first exercise to start logging sets.</AppText>
      ) : null}

      {workout.exercises.map((ex) => (
        <ExerciseBlock
          key={`${ex.id}-${units}`}
          exercise={ex}
          onAddSet={async (set) => {
            await addSet(db, ex.id, set);
            await reload();
          }}
          onDeleteSet={async (setId) => {
            await deleteSet(db, setId);
            await reload();
          }}
          onRemove={async () => {
            await removeExerciseFromWorkout(db, ex.id);
            await reload();
          }}
        />
      ))}

      <Button
        label="Add exercise"
        variant="secondary"
        onPress={() => router.push({ pathname: '/exercise-picker', params: { workoutId } })}
      />
      {active ? (
        <Button label={setCount === 0 ? 'Discard workout' : 'Finish workout'} onPress={finish} />
      ) : null}
    </Screen>
  );
}
