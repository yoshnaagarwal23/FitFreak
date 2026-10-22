# FitFreak backend (`/ml`)

FastAPI service the app calls over HTTP. Today it hosts the **AI meal planner**; the ML models
(phases 8–12) will live here too.

## Setup

```bash
cd ml
cp .env.example .env      # then paste your Anthropic API key into .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

The app expects the server at `http://localhost:8000`. To point it elsewhere, start Expo with
`EXPO_PUBLIC_API_URL=http://your-host:8000 npx expo start --web`.

`.env` is git-ignored. The key never goes to the app.

## How meal planning works

`POST /meal-plan` with targets, the app's food list, the meals to plan, and preferences.

1. **Claude chooses** (`planner.py`): foods by id from the app's list, grams per item, a dish
   name and short instructions — constrained to a JSON schema (`schemas.LLM_PLAN_SCHEMA`).
   Model `claude-opus-5-5`, medium effort, with server-side refusal fallback enabled.
2. **The server computes** (`nutrition.py`, no AI): every macro from the app's per-100 g data,
   and rejects plans that use unknown foods, non-veg foods for a vegetarian, or portions
   outside 5–1000 g.
3. **One repair round**: if the plan broke a rule or missed targets (±10% calories/protein,
   ±20% carbs/fat), Claude gets the real computed totals and one chance to fix it. The better
   of the two attempts is returned, with honest `deviation` and `within_tolerance` fields.

The app validates the response again before showing it (`src/lib/mealPlan.ts`).

## Tests

```bash
uv run pytest
```

Tests use a fake Claude client, so they need no API key and cost nothing.
