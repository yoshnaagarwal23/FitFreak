import type { SQLiteDatabase } from 'expo-sqlite';

import { getFoodLogs } from '@/db/foodLogs';
import { getMacroSettings } from '@/db/macroSettings';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { toDateKey } from '@/lib/date';
import { resolveTargets, sumMacros } from '@/lib/macros';

const loadToday = async (db: SQLiteDatabase) => {
  const dateKey = toDateKey();
  const [settings, logs] = await Promise.all([getMacroSettings(db), getFoodLogs(db, dateKey)]);
  return { dateKey, targets: resolveTargets(settings), logs, totals: sumMacros(logs) };
};

// Today's targets, food log entries, and running totals. Reloads on screen focus.
export function useMacroDay() {
  return useFocusQuery(loadToday);
}
