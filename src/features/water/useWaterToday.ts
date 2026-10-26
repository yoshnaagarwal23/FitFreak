import { useFocusEffect } from 'expo-router';
import { useDb } from '@/db/supabase';
import { useCallback, useState } from 'react';

import {
  addWater,
  getGoalGlasses,
  getTotalMl,
  removeLatestWater,
  setGoalGlasses,
} from '@/db/water';
import { toDateKey } from '@/lib/date';
import { DEFAULT_GOAL_GLASSES, GLASS_ML } from '@/lib/water';

// Connects today's water data in SQLite to React state.
// After every write we re-read from the database so the UI always reflects storage.
export function useWaterToday() {
  const db = useDb();
  const [totalMl, setTotalMl] = useState(0);
  const [goalGlasses, setGoal] = useState(DEFAULT_GOAL_GLASSES);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [total, goal] = await Promise.all([getTotalMl(db, toDateKey()), getGoalGlasses(db)]);
    setTotalMl(total);
    setGoal(goal);
    setLoaded(true);
  }, [db]);

  // Reload whenever the screen gains focus (also covers the day rolling over).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const addGlass = useCallback(async () => {
    await addWater(db, GLASS_ML);
    await refresh();
  }, [db, refresh]);

  const undo = useCallback(async () => {
    await removeLatestWater(db, toDateKey());
    await refresh();
  }, [db, refresh]);

  const changeGoal = useCallback(
    async (glasses: number) => {
      await setGoalGlasses(db, glasses);
      await refresh();
    },
    [db, refresh],
  );

  return { totalMl, goalGlasses, loaded, addGlass, undo, changeGoal };
}
