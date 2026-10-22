import type { SQLiteDatabase } from 'expo-sqlite';

import type { MacroSettings } from '@/lib/macros';

import { getSetting, setSetting } from './settings';

const KEY = 'macro_settings';

export async function getMacroSettings(db: SQLiteDatabase): Promise<MacroSettings | null> {
  const raw = await getSetting(db, KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as MacroSettings;
    return parsed.mode === 'auto' || parsed.mode === 'manual' ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveMacroSettings(db: SQLiteDatabase, settings: MacroSettings) {
  await setSetting(db, KEY, JSON.stringify(settings));
}
