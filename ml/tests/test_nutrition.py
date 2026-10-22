import json

import pytest

from app.meal_plan.nutrition import PlanIssues, build_plan, deviation, macros_for, sum_macros, within_tolerance
from app.meal_plan.schemas import LLM_PLAN_SCHEMA, LlmPlan, Macros

from .conftest import FOODS, GOOD, plan_json


def test_macros_scale_linearly():
    m = macros_for(FOODS[0], 80)  # 2 rotis
    assert (m.calories, m.protein, m.carbs, m.fat) == pytest.approx((240, 8, 40, 6))


def test_good_plan_hits_targets_exactly(request_2_meals):
    meals = build_plan(LlmPlan.model_validate_json(GOOD), request_2_meals)
    assert [m.meal for m in meals] == ["lunch", "dinner"]  # request order, sorted by meal time
    totals = sum_macros([m.totals for m in meals])
    dev = deviation(totals, request_2_meals.targets)
    assert all(abs(v) < 1e-9 for v in dev.values())
    assert within_tolerance(dev)
    assert meals[0].items[0].food_name == "Roti"


@pytest.mark.parametrize(
    "lunch, expected",
    [
        ([{"food_id": 99, "grams": 100}], "food_id 99 is not in the food list"),
        ([{"food_id": 5, "grams": 100}], "Egg is not vegetarian"),
        ([{"food_id": 1, "grams": 2}], "outside 5–1000 g"),
        ([{"food_id": 1, "grams": 1500}], "outside 5–1000 g"),
        ([], "lunch has no items"),
    ],
)
def test_rule_violations_are_reported(request_2_meals, lunch, expected):
    bad = plan_json(lunch, [{"food_id": 3, "grams": 100}])
    with pytest.raises(PlanIssues) as e:
        build_plan(LlmPlan.model_validate_json(bad), request_2_meals)
    assert any(expected in i for i in e.value.issues)


def test_wrong_meal_slots_rejected(request_2_meals):
    plan = LlmPlan.model_validate(
        {"meals": [{"meal": "breakfast", "name": "x", "items": [{"food_id": 1, "grams": 40}], "instructions": ""}], "notes": ""}
    )
    with pytest.raises(PlanIssues) as e:
        build_plan(plan, request_2_meals)
    assert "exactly these meals" in e.value.issues[0]


def test_non_veg_allowed_when_not_vegetarian(request_2_meals):
    req = request_2_meals.model_copy(update={"vegetarian": False})
    plan = plan_json([{"food_id": 5, "grams": 100}], [{"food_id": 3, "grams": 100}])
    assert build_plan(LlmPlan.model_validate_json(plan), req)[0].items[0].food_name == "Egg"


def test_deviation_and_tolerance():
    target = Macros(calories=2000, protein=100, carbs=250, fat=60)
    dev = deviation(Macros(calories=2150, protein=92, carbs=290, fat=50), target)
    assert dev["calories"] == pytest.approx(0.075)
    assert dev["protein"] == pytest.approx(-0.08)
    assert within_tolerance(dev)  # carbs +16%, fat -16.7% are inside ±20%
    assert not within_tolerance({**dev, "protein": -0.11})
    zero = deviation(Macros(calories=100, protein=0, carbs=0, fat=5), Macros(calories=100, protein=0, carbs=0, fat=0))
    assert zero["protein"] == 0 and zero["fat"] == 1.0


def _schema_keys(schema: dict, path=""):
    """Yields (path, required, properties) for every object in the JSON schema."""
    if schema.get("type") == "object":
        yield path, set(schema["required"]), set(schema["properties"])
        for k, v in schema["properties"].items():
            yield from _schema_keys(v, f"{path}.{k}")
    if schema.get("type") == "array":
        yield from _schema_keys(schema["items"], f"{path}[]")


def test_structured_output_schema_matches_pydantic_model():
    # Strict structured outputs: every object lists all properties as required and forbids extras.
    for path, required, props in _schema_keys(LLM_PLAN_SCHEMA):
        assert required == props, path
    objects = [s for s in json.dumps(LLM_PLAN_SCHEMA).split('"type": "object"')][1:]
    assert len(objects) == json.dumps(LLM_PLAN_SCHEMA).count('"additionalProperties": false')
    # Field names line up with the Pydantic models used to validate the response.
    assert set(LLM_PLAN_SCHEMA["properties"]) == set(LlmPlan.model_fields)
    meal = LLM_PLAN_SCHEMA["properties"]["meals"]["items"]
    assert set(meal["properties"]) == set(LlmPlan.model_fields["meals"].annotation.__args__[0].model_fields)
    LlmPlan.model_validate_json(GOOD)
