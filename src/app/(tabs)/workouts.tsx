import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { getActiveSplit } from '@/db/splits';
import { getActiveWorkout, getRecentWorkouts, startWorkout, startWorkoutFromSplitDay } from '@/db/workouts';
import { SplitCard } from '@/features/split/SplitCard';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { formatDateKey } from '@/lib/date';
import { useUnits } from '@/features/settings/UnitsProvider';
import { formatMass } from '@/lib/units';

const loadWorkouts = async (db: SQLiteDatabase) => {
  const [active, recent, split] = await Promise.all([
    getActiveWorkout(db),
    getRecentWorkouts(db),
    getActiveSplit(db),
  ]);
  return { active, recent, split };
};

export default function WorkoutsScreen() {
  const { db, data } = useFocusQuery(loadWorkouts);
  const { units } = useUnits();

  const start = async () => {
    const id = await startWorkout(db);
    router.push(`/workout/${id}`);
  };

  const startFromSplit = async (splitDayId: number) => {
    const id = await startWorkoutFromSplitDay(db, splitDayId);
    router.push(`/workout/${id}`);
  };

  return (
    <Screen title="Workouts" subtitle="Log sets and follow your split.">
      {data?.active ? (
        <Card>
          <AppText>Workout in progress</AppText>
          <AppText variant="caption" muted>
            Started {formatDateKey(data.active.performedOn)}
          </AppText>
          <Button label="Continue workout" onPress={() => router.push(`/workout/${data.active!.id}`)} />
        </Card>
      ) : (
        <Button label="Start empty workout" variant="secondary" onPress={start} disabled={!data} />
      )}

      {data ? (
        <SplitCard split={data.split} onStartDay={startFromSplit} disabled={data.active !== null} />
      ) : null}

      {data && data.recent.length > 0 ? (
        <>
          <AppText variant="caption" muted>
            HISTORY
          </AppText>
          {data.recent.map((w) => (
            <ListRow
              key={w.id}
              title={formatDateKey(w.performedOn)}
              detail={`${w.exerciseCount} exercise${w.exerciseCount === 1 ? '' : 's'} · ${w.setCount} set${w.setCount === 1 ? '' : 's'}`}
              trailing={formatMass(w.volumeKg, units)}
              onPress={() => router.push(`/workout/${w.id}`)}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
