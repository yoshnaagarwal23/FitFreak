"""FitFreak backend. Run with: uv run uvicorn app.main:app --reload --port 8000"""

import logging
import os
from functools import lru_cache

import anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.meal_plan.planner import MealPlanner, PlannerError
from app.meal_plan.schemas import MealPlanRequest, MealPlanResponse

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("fitfreak")

app = FastAPI(title="FitFreak API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:8081").split(",")],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@lru_cache
def get_planner() -> MealPlanner:
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "The server has no ANTHROPIC_API_KEY. Add it to ml/.env and restart.")
    return MealPlanner(anthropic.AsyncAnthropic())


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/meal-plan", response_model=MealPlanResponse)
async def meal_plan(req: MealPlanRequest, planner: MealPlanner = Depends(get_planner)) -> MealPlanResponse:
    try:
        return await planner.plan(req)
    except PlannerError as e:
        raise HTTPException(502, e.message) from e
    except anthropic.AuthenticationError as e:
        log.error("Anthropic auth failed: %s", e)
        raise HTTPException(500, "The server's Anthropic API key was rejected.") from e
    except anthropic.RateLimitError as e:
        raise HTTPException(429, "Too many requests to the AI right now. Wait a minute and retry.") from e
    except anthropic.APIConnectionError as e:
        raise HTTPException(503, "Couldn't reach the AI service. Check the server's internet connection.") from e
    except anthropic.APIStatusError as e:
        log.error("Anthropic API error %s: %s", e.status_code, e)
        raise HTTPException(502, "The AI service returned an error. Try again.") from e
