# FitFreak

A minimalist fitness app for vegetarian, Indian-friendly training and nutrition: weekly
split generator, workout logger, macro and water tracking, and an AI meal planner that
hits macro targets — with an ML layer on the way.

Built with Expo (React Native + TypeScript) so the same code runs on the web today and
ships to iOS later, plus a Python FastAPI service for AI and ML.

| Today | Meals | AI meal planner |
|---|---|---|
| ![Today](docs/screenshots/today.png) | ![Meals](docs/screenshots/meals.png) | ![Meal planner](docs/screenshots/meal-planner.png) |

| Split builder | Workout | Lift history |
|---|---|---|
| ![Split builder](docs/screenshots/split-builder.png) | ![Workout](docs/screenshots/workout.png) | ![History](docs/screenshots/lift-history.png) |

## Features

- **Split generator** — rule-based weekly plan from goal, days per week, experience, and
  equipment, with a "why this plan" explanation; every day and exercise is editable.
- **Workout logger** — sets, reps, and weight per exercise; prefills from your last
  session; targets from your split ("3 × 6–10 · 1/3 done"); estimated 1RM history chart.
- **Macro tracker** — targets calculated from body stats (Mifflin-St Jeor, shown step by
  step) or entered by hand; 47 built-in foods with Indian portions (roti, katori); custom
  foods from nutrition labels.
- **AI meal planner** — Claude picks real foods and portions for your remaining macros;
  the server computes and checks every number before the app shows it.
- **Water tracker** — one-tap glass logging toward a daily goal.
- **Metric or imperial** — kg/cm or lb/ft-in everywhere you type or read a measurement.

## Architecture

```mermaid
flowchart LR
  subgraph App["Expo app (web now, iOS later)"]
    UI["Screens<br/>src/app, src/features"] --> Logic["Pure logic<br/>src/lib"]
    UI --> Repo["Data access<br/>src/db"]
    Repo --> SQLite[("SQLite<br/>expo-sqlite")]
    UI --> Client["API client<br/>src/api"]
  end
  subgraph API["FastAPI service (/ml)"]
    Route["POST /meal-plan"] --> Planner["planner.py<br/>retry + pick best"]
    Planner --> Nutrition["nutrition.py<br/>macro math + rule checks"]
  end
  Client -- "targets + food list (JSON)" --> Route
  Planner -- "structured output" --> Claude["Claude API"]
```

The code is organised in layers, and each layer only talks to the one beneath it:

| Layer | Where | Rule |
|---|---|---|
| Screens | `src/app/` (one file per route, Expo Router) | Layout and wiring only |
| Feature components | `src/features/<feature>/` | UI for one feature, plus its hooks |
| Shared components | `src/components/` | Generic UI; all styling from `src/theme.ts` |
| Pure logic | `src/lib/` | No storage, no UI, no network — unit-testable math and validation |
| Data access | `src/db/` | All SQL lives here; schema changes go through numbered migrations |
| Backend | `ml/app/` | FastAPI; holds the Anthropic key; never trusted blindly by the app |

### Design decisions

- **AI chooses, code computes.** For meal plans, Claude only picks food ids, grams, dish
  names, and instructions — constrained to a JSON schema. The server calculates every
  macro from the app's own food data, rejects unknown foods, non-veg items in vegetarian
  plans, and absurd portions, and gives Claude one correction round with the real
  numbers. The app validates the response again before display. Nutrition numbers never
  come from the model.
- **Deterministic logic is separate from AI.** Split generation, target calculation, and
  macro math are plain functions in `src/lib/` with exhaustive tests (e.g. all 960 split
  input combinations are checked against the rules).
- **Storage is metric; units are a display concern.** Converting only at the input/output
  boundary means switching units never rewrites history.
- **History is immutable.** Food logs copy their macros at log time; workouts copy their
  split targets when started. Editing a food or a split never changes past days.
- **Migrations, not resets.** The schema evolves through append-only migrations tracked by
  SQLite's `user_version`, each tested against an older database with real data in it.
- **Model training data from day one.** Every set, glass, and food entry is stored as an
  individual timestamped event, and workouts record their targets — the raw material for
  the progressive-overload model.

## Getting started

Requirements: Node 20+, [uv](https://docs.astral.sh/uv/) (Python), an Anthropic API key
for the meal planner.

```bash
npm install
npx expo start --web            # app at http://localhost:8081

cp ml/.env.example ml/.env      # add your ANTHROPIC_API_KEY
npm run api                     # backend at http://localhost:8000
```

The app works without the backend; only the AI meal planner needs it.

## Tests

```bash
npm test          # app logic + database tests (Node's built-in runner and SQLite)
npm run test:api  # backend tests (pytest, fake Claude client — no key or cost)
npm run test:db   # cloud schema: applies supabase/migrations to a throwaway local
                  # Postgres and checks row-level security with two users
npm run typecheck
npx expo lint
```

## Repository layout

```
src/
  app/          routes (tabs: Today, Workouts, Meals, Progress; plus pushed screens)
  features/     water, workouts, split, macros, mealPlan, settings
  components/   shared UI (Screen, Card, Button, OptionGroup, LineChart, ProgressRing…)
  lib/          pure logic: macros, split rules, workout math, units, meal-plan validation
  db/           SQLite migrations and queries; seed exercises and foods
  api/          HTTP client for the backend
  theme.ts      colors, spacing, type scale — the only place styles are defined
ml/
  app/          FastAPI app; meal_plan/ (schemas, prompt, planner, nutrition)
  tests/        pytest suite
supabase/
  migrations/   cloud schema, row-level security, RPC functions, built-in reference data
scripts/        reference-data SQL generator, local database test runner
tests/          app tests (node --test); tests/db for the cloud schema
docs/           screenshots
```

## Roadmap

- [x] Phases 1–6 — scaffold, water, workouts, split generator, macros, AI meal planner
- [ ] Accounts and cloud data (Supabase auth + Postgres with row-level security)
- [ ] Hosted website for friends; AI planner limited per user per day
- [ ] Front-end overhaul — desktop layout, dashboard with weekly charts, onboarding, dark mode
- [ ] ML: synthetic training data → progressive-overload predictor (linear baseline vs
      gradient boosting, time-based split) → LP meal optimiser → SHAP explanations in the app
- [ ] iOS build with EAS

## Notes on data

Built-in food values are compiled from USDA FoodData Central, the Indian Food Composition
Tables (IFCT 2017), and typical home recipes for mixed dishes. They're rounded
approximations — add a custom food from the label when precision matters.

## License

[MIT](LICENSE)
