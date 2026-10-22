# FitApp — Project Guide for Claude Code

## What we're building
A minimalist fitness app with five features:
1. **Split generator** — builds a weekly workout split from goal, days/week, experience, and equipment
2. **AI meal planner** — generates meals hitting macro targets; vegetarian and Indian-friendly by default (dal, paneer, chana, rajma, curd, roti, rice, poha, idli, etc.)
3. **Macro tracker** — log foods, see daily protein/carbs/fat/calories vs. targets
4. **Water tracker** — one-tap glass logging toward a daily goal
5. **Workout logger** — log sets/reps/weight per exercise, see history and progress

## Tech stack
- **Expo (React Native) + TypeScript** — runs in the browser now, ships to iOS later with no rewrite
- **Expo Router** for navigation (bottom tabs: Today, Workouts, Meals, Progress)
- **expo-sqlite** for local storage first; add Supabase later for accounts/sync
- **Claude API** for meal generation, called ONLY through a backend (Supabase Edge Function or small FastAPI server). Never put the API key in the app.
- **Nutrition data**: USDA FoodData Central + Indian Food Composition Tables (IFCT 2017) for Indian foods

## Design system (minimal, blue + white)
- Background `#FFFFFF`, surface `#F5F8FF`
- Primary `#2563EB`, primary-light `#DBEAFE`, primary-dark `#1E3A8A`
- Text `#0F172A`, muted text `#64748B`, borders `#E2E8F0`
- One font (Inter or system), 3 sizes max per screen
- Generous whitespace, rounded cards (12px radius), no shadows or very subtle ones
- Progress rings/bars in primary blue for macros and water
- Keep all colors/spacing in `theme.ts` — no hardcoded values in components

## Build phases (do one at a time, confirm before moving on)
1. Scaffold Expo app, theme.ts, tab navigation, empty screens
2. Water tracker (simplest feature — proves storage works)
3. Workout logger (exercises, sets, history)
4. Split generator (rule-based first, no AI needed)
5. Macro tracker + food search
6. AI meal planner via backend → Claude API, returns JSON matching macro targets
7. Polish, then iOS build with EAS

## ML layer (the core of this project)
This is an AI/ML portfolio project. ML lives in a separate Python service (`/ml`, FastAPI + scikit-learn), the app calls it over HTTP.

8. **Synthetic data generator** — realistic users, workouts, meals, weights with noise, missed days, and plateaus. Document the generation rules (models will learn them).
9. **Progressive overload predictor** — regression predicting next session's weight/reps. Baseline: linear regression. Then gradient boosting. Report MAE vs. baseline.
10. **Macro-optimal meal selection** — linear programming (PuLP) picks a vegetarian/Indian meal combo hitting protein/carb/fat targets. LLM writes recipes; the optimizer chooses.
11. **Explainability** — SHAP values shown in the app ("suggested +2.5kg because: 3 sessions completed at target reps").
12. **Model evaluation write-up** — train/test split by time (no leakage), metrics, limitations of synthetic data. Goes in README.

Stretch: K-means habit clusters, weight forecasting, text-to-log food parsing.

## Rules
- Explain what you're doing briefly before each phase; I'm learning
- Keep the deterministic logic (macro math, split rules) separate from AI calls
- AI meal output must be structured JSON, validated before display
- Write small components; test on web (`npx expo start --web`) after each phase
