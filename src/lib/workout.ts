// Pure workout math and validation. No storage or UI here. Weights are stored in kg.

import { formatMass, kgToUserMass, massUnit, userMassToKg, type UnitSystem } from './units';

export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'other';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'other';

export type SetEntry = { weightKg: number; reps: number };

export const MAX_REPS = 100;
export const MAX_WEIGHT_KG = 1000;

// Estimated one-rep max (Epley formula). A single rep is its own 1RM.
export function estimate1RM({ weightKg, reps }: SetEntry): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function volume(sets: SetEntry[]): number {
  return sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}

// The set with the highest estimated 1RM; ties go to the earlier set.
export function bestSet<T extends SetEntry>(sets: T[]): T | null {
  let best: T | null = null;
  for (const s of sets) {
    if (best === null || estimate1RM(s) > estimate1RM(best)) best = s;
  }
  return best;
}

export type SessionRow = SetEntry & { workoutId: number; performedOn: string };
export type Session = { workoutId: number; performedOn: string; sets: SetEntry[]; best1RM: number };

// Groups rows (already ordered by time) into one entry per workout, oldest first.
export function groupSessions(rows: SessionRow[]): Session[] {
  const byWorkout = new Map<number, Session>();
  for (const r of rows) {
    let session = byWorkout.get(r.workoutId);
    if (!session) {
      session = { workoutId: r.workoutId, performedOn: r.performedOn, sets: [], best1RM: 0 };
      byWorkout.set(r.workoutId, session);
    }
    session.sets.push({ weightKg: r.weightKg, reps: r.reps });
  }
  const sessions = [...byWorkout.values()];
  for (const s of sessions) {
    const top = bestSet(s.sets);
    s.best1RM = top ? estimate1RM(top) : 0;
  }
  return sessions;
}

export type ParsedSet = { ok: true; set: SetEntry } | { ok: false; error: string };

// Validates the raw text from the weight/reps inputs (weight in the user's units). Weight 0 = bodyweight.
export function parseSetInput(weightText: string, repsText: string, units: UnitSystem): ParsedSet {
  const value = Number(weightText.trim().replace(',', '.'));
  const reps = Number(repsText.trim());
  const max = Math.floor(kgToUserMass(MAX_WEIGHT_KG, units));
  if (weightText.trim() === '' || !Number.isFinite(value) || value < 0 || value > max) {
    return { ok: false, error: `Weight must be 0–${max} ${massUnit(units)}` };
  }
  if (!Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) {
    return { ok: false, error: `Reps must be a whole number, 1–${MAX_REPS}` };
  }
  return { ok: true, set: { weightKg: Math.round(userMassToKg(value, units) * 1000) / 1000, reps } };
}

// 82.5 → "82.5 kg" / "181.9 lb", 0 → "BW"
export function formatWeight(kg: number, units: UnitSystem): string {
  return kg === 0 ? 'BW' : formatMass(kg, units);
}

export function formatSet({ weightKg, reps }: SetEntry, units: UnitSystem): string {
  return `${formatWeight(weightKg, units)} × ${reps}`;
}
