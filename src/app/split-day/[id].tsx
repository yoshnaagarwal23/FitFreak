import { router, Stack, useLocalSearchParams } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { OptionGroup } from '@/components/OptionGroup';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import {
  deleteSplitDay,
  getSplitDay,
  moveSplitExercise,
  removeSplitExercise,
  updateSplitDay,
  updateSplitExerciseTarget,
} from '@/db/splits';
import { SplitExerciseEditor } from '@/features/split/SplitExerciseEditor';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { weekdayName } from '@/lib/date';

const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: weekdayName(d) }));

export default function SplitDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dayId = Number(id);

  const query = useCallback((db: SQLiteDatabase) => getSplitDay(db, dayId), [dayId]);
  const { db, data: day, reload } = useFocusQuery(query);

  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (day === undefined) return <Screen subtitle="Loading…" />;
  if (day === null) return <Screen subtitle="This day no longer exists." />;

  const saveTitle = async () => {
    const title = titleDraft?.trim();
    setTitleDraft(null);
    if (title && title !== day.title) {
      await updateSplitDay(db, dayId, { title });
      await reload();
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteSplitDay(db, dayId);
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: `Edit ${day.title}` }} />

      <TextField
        label="Day name"
        value={titleDraft ?? day.title}
        onChangeText={setTitleDraft}
        onBlur={saveTitle}
        onSubmitEditing={saveTitle}
        returnKeyType="done"
      />

      <OptionGroup
        label="Weekday"
        options={WEEKDAY_OPTIONS}
        isSelected={(v) => v === day.weekday}
        onPress={async (weekday) => {
          await updateSplitDay(db, dayId, { weekday });
          await reload();
        }}
      />

      {day.exercises.length === 0 ? <AppText muted>No exercises yet.</AppText> : null}

      {day.exercises.map((ex, i) => (
        <SplitExerciseEditor
          key={ex.id}
          exercise={ex}
          isFirst={i === 0}
          isLast={i === day.exercises.length - 1}
          onChangeTarget={async (target) => {
            await updateSplitExerciseTarget(db, ex.id, target);
            await reload();
          }}
          onMove={async (direction) => {
            await moveSplitExercise(db, ex.id, direction);
            await reload();
          }}
          onRemove={async () => {
            await removeSplitExercise(db, ex.id);
            await reload();
          }}
        />
      ))}

      <Button
        label="Add exercise"
        variant="secondary"
        onPress={() => router.push({ pathname: '/exercise-picker', params: { splitDayId: dayId } })}
      />
      <Button
        label={confirmDelete ? 'Tap again to delete this day' : 'Delete day'}
        variant="secondary"
        onPress={remove}
      />
    </Screen>
  );
}
