import { Redirect, router } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { addSplitDay, getActiveSplit } from '@/db/splits';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { weekdayName } from '@/lib/date';
import { firstFreeWeekday, formatReps } from '@/lib/split';

// Overview of the active split: open a day to edit it, add a day, or rebuild from scratch.
export default function SplitEditScreen() {
  const { db, data: split } = useFocusQuery(getActiveSplit);

  if (split === undefined) return <Screen subtitle="Loading…" />;
  if (split === null) return <Redirect href="/split" />;

  const freeDay = firstFreeWeekday(split.days.map((d) => d.weekday));

  const addDay = async () => {
    if (freeDay === null) return;
    const id = await addSplitDay(db, split.id, freeDay);
    router.push(`/split-day/${id}`);
  };

  return (
    <Screen subtitle={`${split.name} · tap a day to edit it`}>
      {split.days.map((day) => (
        <ListRow
          key={day.id}
          title={`${weekdayName(day.weekday)} · ${day.title}`}
          detail={
            day.exercises.length === 0
              ? 'No exercises yet'
              : day.exercises.map((e) => `${e.name} ${e.sets}×${formatReps(e)}`).join(', ')
          }
          trailing="Edit"
          accessibilityLabel={`Edit ${day.title}`}
          onPress={() => router.push(`/split-day/${day.id}`)}
        />
      ))}

      <Button label="Add a day" variant="secondary" onPress={addDay} disabled={freeDay === null} />

      <AppText variant="caption" muted>
        Rebuilding from the questions creates a new plan and replaces these edits. Past workouts are kept.
      </AppText>
      <Button label="Rebuild from questions" variant="secondary" onPress={() => router.push('/split')} />
    </Screen>
  );
}
