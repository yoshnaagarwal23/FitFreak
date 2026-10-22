import { postJson } from './client';

// Planning can take a while: the server may ask the model twice.
const TIMEOUT_MS = 180_000;

// Returns the raw JSON; callers must validate it with parseMealPlan before use.
export function requestMealPlan(body: unknown): Promise<unknown> {
  return postJson('/meal-plan', body, TIMEOUT_MS);
}
