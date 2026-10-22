import type { Equipment, MuscleGroup } from '@/lib/workout';

// Starter exercise library, inserted once by migration v2.
// Muscle group and equipment tags are used by the split generator (phase 4).
export const SEED_EXERCISES: { name: string; muscleGroup: MuscleGroup; equipment: Equipment }[] = [
  // Chest
  { name: 'Bench Press', muscleGroup: 'chest', equipment: 'barbell' },
  { name: 'Incline Dumbbell Press', muscleGroup: 'chest', equipment: 'dumbbell' },
  { name: 'Chest Press Machine', muscleGroup: 'chest', equipment: 'machine' },
  { name: 'Cable Fly', muscleGroup: 'chest', equipment: 'cable' },
  { name: 'Push-up', muscleGroup: 'chest', equipment: 'bodyweight' },
  // Back
  { name: 'Deadlift', muscleGroup: 'back', equipment: 'barbell' },
  { name: 'Barbell Row', muscleGroup: 'back', equipment: 'barbell' },
  { name: 'Dumbbell Row', muscleGroup: 'back', equipment: 'dumbbell' },
  { name: 'Lat Pulldown', muscleGroup: 'back', equipment: 'cable' },
  { name: 'Seated Cable Row', muscleGroup: 'back', equipment: 'cable' },
  { name: 'Pull-up', muscleGroup: 'back', equipment: 'bodyweight' },
  // Legs
  { name: 'Back Squat', muscleGroup: 'legs', equipment: 'barbell' },
  { name: 'Romanian Deadlift', muscleGroup: 'legs', equipment: 'barbell' },
  { name: 'Goblet Squat', muscleGroup: 'legs', equipment: 'dumbbell' },
  { name: 'Walking Lunge', muscleGroup: 'legs', equipment: 'dumbbell' },
  { name: 'Leg Press', muscleGroup: 'legs', equipment: 'machine' },
  { name: 'Leg Curl', muscleGroup: 'legs', equipment: 'machine' },
  { name: 'Leg Extension', muscleGroup: 'legs', equipment: 'machine' },
  { name: 'Calf Raise', muscleGroup: 'legs', equipment: 'machine' },
  // Shoulders
  { name: 'Overhead Press', muscleGroup: 'shoulders', equipment: 'barbell' },
  { name: 'Dumbbell Shoulder Press', muscleGroup: 'shoulders', equipment: 'dumbbell' },
  { name: 'Lateral Raise', muscleGroup: 'shoulders', equipment: 'dumbbell' },
  { name: 'Face Pull', muscleGroup: 'shoulders', equipment: 'cable' },
  // Arms
  { name: 'Barbell Curl', muscleGroup: 'arms', equipment: 'barbell' },
  { name: 'Dumbbell Curl', muscleGroup: 'arms', equipment: 'dumbbell' },
  { name: 'Skull Crusher', muscleGroup: 'arms', equipment: 'barbell' },
  { name: 'Triceps Pushdown', muscleGroup: 'arms', equipment: 'cable' },
  { name: 'Dips', muscleGroup: 'arms', equipment: 'bodyweight' },
  // Core
  { name: 'Cable Crunch', muscleGroup: 'core', equipment: 'cable' },
  { name: 'Hanging Leg Raise', muscleGroup: 'core', equipment: 'bodyweight' },
];

// Added by migration v3 so every split-generator pattern has bodyweight/dumbbell options.
export const SEED_EXERCISES_V3: { name: string; muscleGroup: MuscleGroup; equipment: Equipment }[] = [
  { name: 'Bodyweight Squat', muscleGroup: 'legs', equipment: 'bodyweight' },
  { name: 'Reverse Lunge', muscleGroup: 'legs', equipment: 'bodyweight' },
  { name: 'Glute Bridge', muscleGroup: 'legs', equipment: 'bodyweight' },
  { name: 'Single-leg Calf Raise', muscleGroup: 'legs', equipment: 'bodyweight' },
  { name: 'Bulgarian Split Squat', muscleGroup: 'legs', equipment: 'dumbbell' },
  { name: 'Dumbbell Romanian Deadlift', muscleGroup: 'legs', equipment: 'dumbbell' },
  { name: 'Dumbbell Fly', muscleGroup: 'chest', equipment: 'dumbbell' },
  { name: 'Pike Push-up', muscleGroup: 'shoulders', equipment: 'bodyweight' },
  { name: 'Cable Lateral Raise', muscleGroup: 'shoulders', equipment: 'cable' },
  { name: 'Reverse Dumbbell Fly', muscleGroup: 'shoulders', equipment: 'dumbbell' },
  { name: 'Inverted Row', muscleGroup: 'back', equipment: 'bodyweight' },
  { name: 'Chin-up', muscleGroup: 'back', equipment: 'bodyweight' },
  { name: 'Overhead Dumbbell Extension', muscleGroup: 'arms', equipment: 'dumbbell' },
];
