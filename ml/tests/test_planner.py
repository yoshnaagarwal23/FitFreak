import asyncio

import pytest

from app.meal_plan.planner import FALLBACK_BETA, MODEL, MealPlanner, PlannerError

from .conftest import GOOD, HALF, FakeClient, plan_json, response


def run(coro):
    return asyncio.run(coro)


def test_on_target_first_try(request_2_meals):
    client = FakeClient([response(GOOD)])
    result = run(MealPlanner(client).plan(request_2_meals))
    assert result.attempts == 1 and result.within_tolerance
    assert result.totals.calories == pytest.approx(1125)
    call = client.calls[0]
    assert call["model"] == MODEL
    assert call["fallbacks"] == "default" and call["betas"] == [FALLBACK_BETA]
    assert call["output_config"]["format"]["type"] == "json_schema"
    assert call["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert "Egg" not in call["system"][0]["text"], "non-veg foods hidden from a vegetarian plan"


def test_off_target_gets_one_repair_with_real_numbers(request_2_meals):
    client = FakeClient([response(HALF), response(GOOD)])
    result = run(MealPlanner(client).plan(request_2_meals))
    assert result.attempts == 2 and result.within_tolerance and result.notes == "ok"
    retry = client.calls[1]["messages"]
    assert retry[1]["role"] == "assistant" and retry[1]["content"][0].type == "thinking", "assistant turn passed back unchanged"
    assert "calories -50%" in retry[2]["content"]


def test_returns_best_attempt_when_never_on_target(request_2_meals):
    worse = plan_json([{"food_id": 1, "grams": 20}], [{"food_id": 3, "grams": 20}], notes="worse")
    client = FakeClient([response(HALF), response(worse)])
    result = run(MealPlanner(client).plan(request_2_meals))
    assert result.attempts == 2 and not result.within_tolerance
    assert result.notes == "half", "keeps the closer of the two plans"
    assert result.deviation["calories"] == pytest.approx(-0.5)


def test_invalid_food_then_fixed(request_2_meals):
    bad = plan_json([{"food_id": 42, "grams": 100}], [{"food_id": 3, "grams": 100}])
    client = FakeClient([response(bad), response(GOOD)])
    result = run(MealPlanner(client).plan(request_2_meals))
    assert result.within_tolerance
    assert "food_id 42 is not in the food list" in client.calls[1]["messages"][2]["content"]


def test_garbage_json_twice_raises(request_2_meals):
    client = FakeClient([response("{not json"), response('{"meals": 3}')])
    with pytest.raises(PlannerError):
        run(MealPlanner(client).plan(request_2_meals))


def test_refusal_and_truncation_raise(request_2_meals):
    with pytest.raises(PlannerError, match="declined"):
        run(MealPlanner(FakeClient([response(None, "refusal")])).plan(request_2_meals))
    with pytest.raises(PlannerError, match="cut off"):
        run(MealPlanner(FakeClient([response(GOOD[:50], "max_tokens")])).plan(request_2_meals))


def test_user_notes_are_delimited(request_2_meals):
    req = request_2_meals.model_copy(update={"notes": "no onion or garlic"})
    client = FakeClient([response(GOOD)])
    run(MealPlanner(client).plan(req))
    assert "<user_notes>\nno onion or garlic\n</user_notes>" in client.calls[0]["messages"][0]["content"]
