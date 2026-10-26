import type { MacroSettings } from '@/lib/macros';

import type { Db } from './client';
import { getUserSettings, updateUserSettings } from './settings';

export async function getMacroSettings(db: Db): Promise<MacroSettings | null> {
  const parsed = (await getUserSettings(db))?.macro_settings;
  return parsed?.mode === 'auto' || parsed?.mode === 'manual' ? parsed : null;
}

export async function saveMacroSettings(db: Db, settings: MacroSettings) {
  await updateUserSettings(db, { macro_settings: settings });
}
