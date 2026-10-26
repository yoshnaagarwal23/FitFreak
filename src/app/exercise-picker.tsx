import { router, useLocalSearchParams } from 'expo-router';
import { useDb } from '@/db/supabase';
import { useEffect, useState } from 'react';

import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { createExercise, searchExercises, type Exercise } from '@/db/exercises';
import { addExerciseToSplitDay } from '@/db/splits';
import { addExerciseToWorkout } from '@/db/workouts';

// Modal: pick an exercise (or create a custom one) and add it to a workout or a split day.
export default function ExercisePickerScreen() {
  const { workoutId, splitDayId } = useLocalSearchParams<{ workoutId?: string; splitDayId?: string }>();
  const db = useDb();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Exercise[]>([]);

  useEffect(() => {
    let cancelled = false;
    searchExercises(db, query).then((rows) => {
      if (!cancelled) setResults(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [db, query]);

  const pick = async (exerciseId: number) => {
    if (splitDayId) await addExerciseToSplitDay(db, Number(splitDayId), exerciseId);
    else if (workoutId) await addExerciseToWorkout(db, Number(workoutId), exerciseId);
    router.back();
  };

  const trimmed = query.trim();
  const exactMatch = results.some((e) => e.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <Screen>
      <TextField
        label="Search"
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. Bench Press"
        autoFocus
        autoCorrect={false}
      />

      {trimmed && !exactMatch ? (
        <ListRow
          title={`Create “${trimmed}”`}
          detail="Add as a custom exercise"
          onPress={async () => pick(await createExercise(db, trimmed))}
        />
      ) : null}

      {results.map((e) => (
        <ListRow key={e.id} title={e.name} trailing={e.muscleGroup} onPress={() => pick(e.id)} />
      ))}
    </Screen>
  );
}
