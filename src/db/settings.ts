import type { MacroSettings } from '@/lib/macros';
import type { UnitSystem } from '@/lib/units';

import { must, type Db } from './client';

// One row per user; it doesn't exist until the user first changes a setting.
export type UserSettings = {
  units: UnitSystem;
  water_goal_glasses: number;
  macro_settings: MacroSettings | null;
  last_meal_plan: unknown;
  local_import_at: string | null;
};

export async function getUserSettings(db: Db): Promise<UserSettings | null> {
  return must(
    await db
      .from('user_settings')
      .select('units, water_goal_glasses, macro_settings, last_meal_plan, local_import_at')
      .maybeSingle(),
  );
}

// Creates the row on first use; columns not in `changes` keep their values.
export async function updateUserSettings(
  db: Db,
  changes: Partial<Pick<UserSettings, 'units' | 'water_goal_glasses' | 'macro_settings' | 'last_meal_plan'>>,
) {
  must(await db.from('user_settings').upsert(changes, { onConflict: 'user_id' }));
}
