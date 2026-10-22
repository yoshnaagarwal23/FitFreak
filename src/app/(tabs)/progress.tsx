import { router } from 'expo-router';

import { AppText } from '@/components/AppText';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { getLoggedExercises } from '@/db/exercises';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { formatShortDate } from '@/lib/date';
import { useUnits } from '@/features/settings/UnitsProvider';
import { formatWeight } from '@/lib/workout';

export default function ProgressScreen() {
  const { data: exercises } = useFocusQuery(getLoggedExercises);
  const { units } = useUnits();

  return (
    <Screen title="Progress" subtitle="History and trends over time.">
      {exercises && exercises.length === 0 ? (
        <AppText muted>Finish a workout and your lifts will show up here.</AppText>
      ) : null}

      {exercises?.map((e) => (
        <ListRow
          key={e.id}
          title={e.name}
          detail={`${e.sessionCount} session${e.sessionCount === 1 ? '' : 's'} · last ${formatShortDate(e.lastPerformedOn)}`}
          trailing={e.topWeightKg > 0 ? `top ${formatWeight(e.topWeightKg, units)}` : 'BW'}
          onPress={() => router.push(`/exercise/${e.id}`)}
        />
      ))}
    </Screen>
  );
}
