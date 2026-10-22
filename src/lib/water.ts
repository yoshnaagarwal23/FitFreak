// Pure water-tracking math. No storage or UI here.

export const GLASS_ML = 250;
export const DEFAULT_GOAL_GLASSES = 8;
export const MIN_GOAL_GLASSES = 1;
export const MAX_GOAL_GLASSES = 20;

export function clampGoal(glasses: number): number {
  if (!Number.isFinite(glasses)) return DEFAULT_GOAL_GLASSES;
  return Math.min(MAX_GOAL_GLASSES, Math.max(MIN_GOAL_GLASSES, Math.round(glasses)));
}

export function glassesFromMl(ml: number): number {
  return Math.floor(ml / GLASS_ML);
}

// Fraction of goal reached, capped at 1 for display.
export function progress(totalMl: number, goalGlasses: number): number {
  const goalMl = goalGlasses * GLASS_ML;
  if (goalMl <= 0) return 0;
  return Math.min(1, Math.max(0, totalMl / goalMl));
}
