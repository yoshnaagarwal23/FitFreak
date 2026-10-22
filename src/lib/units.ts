// Unit conversion and formatting. Storage is always metric (kg, cm, g, ml);
// conversion happens only where values are entered or displayed.

export type UnitSystem = 'metric' | 'imperial';

export const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Metric (kg, cm)' },
  { value: 'imperial', label: 'Imperial (lb, ft)' },
];

export const DEFAULT_UNITS: UnitSystem = 'metric';

// Exact definitions.
const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;
const G_PER_OZ = 28.349523125;
const ML_PER_FL_OZ = 29.5735295625;

export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const ozToG = (oz: number) => oz * G_PER_OZ;
export const gToOz = (g: number) => g / G_PER_OZ;
export const mlToFlOz = (ml: number) => ml / ML_PER_FL_OZ;

export function ftInToCm(ft: number, inches: number): number {
  return (ft * 12 + inches) * CM_PER_IN;
}

// Rounds to whole inches, carrying 12 in into the next foot.
export function cmToFtIn(cm: number): { ft: number; in: number } {
  const total = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(total / 12), in: total % 12 };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ---- Lifting / body weight ----

export const massUnit = (u: UnitSystem) => (u === 'imperial' ? 'lb' : 'kg');

// kg → number in the user's unit, rounded to 0.1 (for prefilling inputs).
export const kgToUserMass = (kg: number, u: UnitSystem) => round1(u === 'imperial' ? kgToLb(kg) : kg);

// Number in the user's unit → kg (unrounded; storage keeps full precision).
export const userMassToKg = (value: number, u: UnitSystem) => (u === 'imperial' ? lbToKg(value) : value);

// 61.235 kg → "61.2 kg" or "135 lb"
export function formatMass(kg: number, u: UnitSystem): string {
  return `${kgToUserMass(kg, u)} ${massUnit(u)}`;
}

// ---- Height ----

export function formatHeight(cm: number, u: UnitSystem): string {
  if (u === 'metric') return `${round1(cm)} cm`;
  const { ft, in: inches } = cmToFtIn(cm);
  return `${ft}′ ${inches}″`;
}

// ---- Food portions ----

export const portionUnit = (u: UnitSystem) => (u === 'imperial' ? 'oz' : 'g');

// 80 g → "80 g" or "2.8 oz"
export function formatFoodMass(g: number, u: UnitSystem): string {
  return u === 'imperial' ? `${round1(gToOz(g))} oz` : `${Math.round(g)} g`;
}

// ---- Liquids ----

export function formatVolume(ml: number, u: UnitSystem): string {
  return u === 'imperial' ? `${Math.round(mlToFlOz(ml))} fl oz` : `${Math.round(ml)} ml`;
}
