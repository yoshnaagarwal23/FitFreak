"""Calls Claude for a meal plan, validates it, and retries once with feedback if needed."""

import json
import logging
from dataclasses import dataclass
from typing import Any

from pydantic import ValidationError

from . import prompt
from .nutrition import PlanIssues, build_plan, deviation, error_score, sum_macros, within_tolerance
from .schemas import LLM_PLAN_SCHEMA, LlmPlan, MealPlanRequest, MealPlanResponse, PlanMeal

log = logging.getLogger(__name__)

MODEL = "claude-opus-5-5"
MAX_TOKENS = 16000
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class PlannerError(Exception):
    """The planner could not produce a valid plan. `message` is safe to show the user."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


@dataclass
class _Attempt:
    meals: list[PlanMeal]
    dev: dict[str, float]


class MealPlanner:
    def __init__(self, client: Any, model: str = MODEL, max_attempts: int = 2):
        # `client` is an anthropic.AsyncAnthropic (or a test double with the same shape).
        self.client = client
        self.model = model
        self.max_attempts = max_attempts

    async def plan(self, req: MealPlanRequest) -> MealPlanResponse:
        system = [{"type": "text", "text": prompt.system_prompt(req), "cache_control": {"type": "ephemeral"}}]
        messages: list[dict[str, Any]] = [{"role": "user", "content": prompt.request_message(req)}]
        best: _Attempt | None = None
        best_notes = ""
        attempts = 0

        while attempts < self.max_attempts:
            attempts += 1
            response = await self._call(system, messages)
            llm_plan = self._parse(response)

            issues: list[str] = []
            meals: list[PlanMeal] | None = None
            if llm_plan is None:
                issues = ["The response was not valid JSON for the required schema."]
            else:
                try:
                    meals = build_plan(llm_plan, req)
                except PlanIssues as e:
                    issues = e.issues

            totals = dev = None
            if meals is not None and llm_plan is not None:
                totals = sum_macros([m.totals for m in meals])
                dev = deviation(totals, req.targets)
                if best is None or error_score(dev) < error_score(best.dev):
                    best = _Attempt(meals, dev)
                    best_notes = llm_plan.notes.strip()[:500]
                if within_tolerance(dev):
                    break

            log.info("meal plan attempt %d: issues=%d dev=%s", attempts, len(issues), dev)
            # Keep the assistant turn exactly as returned (thinking blocks included), then add feedback.
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": prompt.repair_message(issues, totals, dev, req.targets)})

        if best is None:
            raise PlannerError("The AI couldn't produce a valid plan from your food list. Try again or add more foods.")

        totals = sum_macros([m.totals for m in best.meals])
        return MealPlanResponse(
            meals=best.meals,
            totals=totals,
            targets=req.targets,
            deviation=best.dev,
            within_tolerance=within_tolerance(best.dev),
            notes=best_notes,
            attempts=attempts,
        )

    async def _call(self, system: list[dict[str, Any]], messages: list[dict[str, Any]]) -> Any:
        response = await self.client.beta.messages.create(
            model=self.model,
            max_tokens=MAX_TOKENS,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": LLM_PLAN_SCHEMA}},
            system=system,
            messages=messages,
        )
        u = response.usage
        log.info(
            "claude usage: model=%s in=%s out=%s cache_read=%s cache_write=%s",
            getattr(response, "model", "?"),
            u.input_tokens,
            u.output_tokens,
            getattr(u, "cache_read_input_tokens", 0),
            getattr(u, "cache_creation_input_tokens", 0),
        )
        if response.stop_reason == "refusal":
            raise PlannerError("The AI declined this request. Try rewording your notes.")
        if response.stop_reason == "max_tokens":
            raise PlannerError("The AI's answer was cut off. Try again.")
        return response

    @staticmethod
    def _parse(response: Any) -> LlmPlan | None:
        text = next((b.text for b in response.content if getattr(b, "type", None) == "text"), None)
        if text is None:
            return None
        try:
            return LlmPlan.model_validate(json.loads(text))
        except (json.JSONDecodeError, ValidationError):
            return None
