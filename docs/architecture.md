# FitFreak architecture

How the pieces fit together. The diagrams are [Mermaid](https://mermaid.js.org/), which GitHub renders in place.
Dashed boxes are planned and not built yet.

## 1. System overview

```mermaid
flowchart LR
  User(["You / friends<br/>in a browser"])

  subgraph App["Expo app (web now, iOS later)"]
    direction TB
    Screens["Screens<br/>src/app"]
    Features["Feature UI + hooks<br/>src/features"]
    Lib["Pure logic<br/>src/lib<br/>macro math, split rules,<br/>validation"]
    Data["Data access<br/>src/db"]
    ApiClient["Meal-plan client<br/>src/api"]
    Local[("Old browser data<br/>SQLite, read-only<br/>src/db/local")]
    Screens --> Features
    Features --> Lib
    Features --> Data
    Features --> ApiClient
    Data -. "one-time import" .-> Local
  end

  subgraph Supabase["Supabase (cloud)"]
    direction TB
    Auth["Auth<br/>email + password,<br/>reset emails"]
    Rest["PostgREST<br/>auto-generated API"]
    PG[("Postgres<br/>tables + row-level security<br/>views + SQL functions")]
    Rest --> PG
    Auth -. "user id in JWT" .-> PG
  end

  subgraph Backend["FastAPI service (/ml)"]
    direction TB
    Route["POST /meal-plan"]
    Planner["planner.py<br/>retry + pick best"]
    Nutrition["nutrition.py<br/>macro math + rule checks"]
    Route --> Planner --> Nutrition
  end

  Claude["Claude API"]
  ML["ML models (phases 8–12)<br/>overload predictor, LP meal picker,<br/>SHAP explanations"]

  User --> Screens
  Features -- "sign in / sign up" --> Auth
  Data -- "supabase-js + user's JWT" --> Rest
  ApiClient -- "targets + food list (JSON)" --> Route
  Planner -- "structured JSON output" --> Claude
  Backend -.-> ML

  classDef planned stroke-dasharray: 5 5,fill:none;
  class ML planned;
```

**Where secrets live.** The app only holds the Supabase URL and *publishable* key. Both are public on purpose, because privacy is enforced inside Postgres (section 4).
The Anthropic key exists only on the FastAPI server, in `ml/.env`.

## 2. Code layers

Each layer only calls the one beneath it, so the logic can be tested without a UI or a network.

```mermaid
flowchart TB
  A["src/app — screens and routes (Expo Router)"]
  B["src/features — UI for one feature, plus its hooks"]
  C["src/components — shared UI, all styling from src/theme.ts"]
  D["src/lib — pure logic: no storage, no UI, no network"]
  E["src/db — every database query; takes a Db client"]
  F["supabase/migrations — schema, security rules, SQL functions"]
  A --> B --> C
  B --> D
  B --> E --> F
```

## 3. Signing in and route guards

`AuthProvider` tracks the session. `src/app/_layout.tsx` uses `Stack.Protected`, so each state can only reach its own screens.

```mermaid
stateDiagram-v2
  [*] --> Loading: app opens
  Loading --> SignedOut: no saved session
  Loading --> SignedIn: session restored

  SignedOut --> SignedOut: sign up → "check your email"
  SignedOut --> SignedIn: log in / confirm email link
  SignedOut --> Recovering: password reset link

  Recovering --> SignedIn: new password saved
  SignedIn --> SignedOut: log out

  state SignedOut {
    [*] --> sign_in_screen
  }
  state Recovering {
    [*] --> new_password_screen
  }
  state SignedIn {
    [*] --> tabs: Today · Workouts · Meals · Progress
    tabs --> settings: import · log out
  }
```

## 4. One request, end to end: adding a set

```mermaid
sequenceDiagram
  autonumber
  participant UI as Workout screen
  participant DB as src/db/workouts.ts
  participant API as Supabase (PostgREST)
  participant PG as Postgres

  UI->>DB: addSet(db, workoutExerciseId, {weightKg, reps})
  DB->>API: rpc('add_set', …) + Authorization: Bearer JWT
  API->>API: verify JWT signature
  API->>PG: set role authenticated, sub = your user id
  PG->>PG: add_set(): does this workout exercise belong to auth.uid()?
  alt yours
    PG->>PG: insert set with next set_number
    PG-->>API: new set id
    API-->>DB: { data: id }
    DB-->>UI: id → screen refreshes
  else someone else's
    PG-->>API: error 42501 (permission denied)
    API-->>DB: { error }
    DB-->>UI: must() throws → error shown
  end
```

**Row-level security** means every table carries a rule like `user_id = auth.uid()`. The database checks it on every read and write, whatever the request came from.
Built-in exercises and foods have `user_id = null`. Everyone can read them, and nobody can change them.

## 5. Data model

Every user-owned table also has `user_id → auth.users`. Deleting an account cascades to all of that user's rows.

```mermaid
erDiagram
  AUTH_USERS ||--o| USER_SETTINGS : has
  AUTH_USERS ||--o{ EXERCISES : "owns custom"
  AUTH_USERS ||--o{ FOODS : "owns custom"
  AUTH_USERS ||--o{ WATER_LOGS : logs
  AUTH_USERS ||--o{ FOOD_LOGS : logs
  AUTH_USERS ||--o{ SPLIT_PLANS : creates
  AUTH_USERS ||--o{ WORKOUTS : performs
  AUTH_USERS ||--o{ AI_USAGE : "counted (server only)"

  SPLIT_PLANS ||--|{ SPLIT_DAYS : contains
  SPLIT_DAYS ||--o{ SPLIT_DAY_EXERCISES : lists
  EXERCISES ||--o{ SPLIT_DAY_EXERCISES : "used in"

  SPLIT_DAYS |o--o{ WORKOUTS : "started from"
  WORKOUTS ||--o{ WORKOUT_EXERCISES : contains
  EXERCISES ||--o{ WORKOUT_EXERCISES : "used in"
  WORKOUT_EXERCISES ||--o{ WORKOUT_SETS : has

  FOODS |o--o{ FOOD_LOGS : "logged as"

  USER_SETTINGS {
    uuid user_id PK
    text units
    int water_goal_glasses
    jsonb macro_settings
    jsonb last_meal_plan
    timestamptz local_import_at
  }
  EXERCISES {
    bigint id PK
    uuid user_id "null = built-in"
    text name
    text muscle_group
    text equipment
  }
  FOODS {
    bigint id PK
    uuid user_id "null = built-in"
    text name
    numeric calories_100g
    numeric protein_100g
    text source
  }
  WORKOUTS {
    bigint id PK
    date performed_on
    timestamptz started_at
    timestamptz finished_at "null = in progress"
  }
  WORKOUT_SETS {
    bigint id PK
    int set_number
    int reps
    numeric weight_kg
  }
  FOOD_LOGS {
    bigint id PK
    date logged_on
    text meal
    numeric grams
    numeric calories
  }
```

Read-only **views** for the Progress screens: `workout_summaries`, `exercise_sets`, `last_sets`, `logged_exercises`. They are `security_invoker`, so they follow the same row-level security.

**SQL functions** handle the writes that touch several rows:
- `start_workout`, `start_workout_from_split_day`, `finish_workout`
- `add_exercise_to_workout`, `add_set`, `delete_set`
- `save_split`, `add_split_day`, `add_exercise_to_split_day`, `move_split_exercise`
- `import_local_data`

## 6. Importing pre-account browser data

```mermaid
flowchart LR
  S[("Browser SQLite<br/>fitfreak.db")] --> R["readLocalSnapshot()<br/>migrate + read all tables"]
  R --> C{"Anything to import?"}
  C -- no --> N["Card hidden / 'nothing to import'"]
  C -- yes --> P["Preview: workouts, sets,<br/>food + water entries"]
  P -- "Import into my account" --> F["import_local_data(jsonb)<br/>one transaction"]
  F --> M1["Match built-in exercises/foods by name"]
  F --> M2["Recreate custom ones as yours"]
  F --> M3["Skip empty workouts; keep your<br/>current active plan/workout"]
  F --> X{"Already imported?"}
  X -- yes --> E["Refused: nothing duplicated"]
```

## 7. How it's tested

```mermaid
flowchart LR
  subgraph unit["npm test"]
    U1["tests/*.test.mts<br/>pure logic: macros, splits,<br/>auth validation, migrations"]
  end
  subgraph db["npm run test:db (scripts/test-db.sh)"]
    P[("Throwaway Postgres 16<br/>port 54329<br/>+ Supabase shim")]
    T1["security.test.sql<br/>alice vs bob vs logged-out"]
    G["PostgREST<br/>port 54330"]
    T2["tests/cloud/*.test.mts<br/>real src/db code with minted JWTs"]
    T1 --> P
    T2 --> G --> P
  end
  subgraph api["npm run test:api"]
    A1["ml/tests<br/>FastAPI planner + validators"]
  end
```

## 8. Planned: hosting and the AI limit

```mermaid
flowchart LR
  B(["Browser"]) --> W["Static website<br/>Vercel / Netlify"]
  W --> SB["Supabase"]
  W -- "JWT" --> R["FastAPI on Render"]
  R -- "verify JWT,<br/>count today's ai_usage" --> SB
  R -- "≤ 5 plans / user / day" --> CL["Claude API"]

  classDef planned stroke-dasharray: 5 5;
  class W,R planned;
```
