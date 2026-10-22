import json
from types import SimpleNamespace

import pytest

from app.meal_plan.schemas import FoodIn, Macros, MealPlanRequest


def food(id, name, kcal, p, c, f, veg=True, serving=("1 serving", 100)):
    return FoodIn(
        id=id,
        name=name,
        serving_label=serving[0],
        serving_grams=serving[1],
        per_100g=Macros(calories=kcal, protein=p, carbs=c, fat=f),
        vegetarian=veg,
    )


FOODS = [
    food(1, "Roti", 300, 10, 50, 7.5, serving=("1 roti", 40)),
    food(2, "Dal", 120, 7, 20, 1),
    food(3, "Paneer", 265, 18, 1, 21),
    food(4, "Rice", 130, 2.7, 28, 0.3),
    food(5, "Egg", 155, 12.6, 1.1, 10.6, veg=False),
]


@pytest.fixture
def request_2_meals() -> MealPlanRequest:
    # Exactly hit by: lunch = 120 g roti + 200 g dal; dinner = 100 g paneer + 200 g rice.
    # roti 360/12/60/9 + dal 240/14/40/2 + paneer 265/18/1/21 + rice 260/5.4/56/0.6
    return MealPlanRequest(
        targets=Macros(calories=1125, protein=49.4, carbs=157, fat=32.6),
        foods=FOODS,
        meals=["dinner", "lunch"],
        vegetarian=True,
    )


def plan_json(lunch_items, dinner_items, notes="ok") -> str:
    return json.dumps(
        {
            "meals": [
                {"meal": "lunch", "name": "Dal roti", "items": lunch_items, "instructions": "Cook."},
                {"meal": "dinner", "name": "Paneer rice", "items": dinner_items, "instructions": "Cook."},
            ],
            "notes": notes,
        }
    )


GOOD = plan_json(
    [{"food_id": 1, "grams": 120}, {"food_id": 2, "grams": 200}],
    [{"food_id": 3, "grams": 100}, {"food_id": 4, "grams": 200}],
)
HALF = plan_json(
    [{"food_id": 1, "grams": 60}, {"food_id": 2, "grams": 100}],
    [{"food_id": 3, "grams": 50}, {"food_id": 4, "grams": 100}],
    notes="half",
)


def response(text: str | None, stop_reason: str = "end_turn"):
    content = [SimpleNamespace(type="thinking", thinking="")]
    if text is not None:
        content.append(SimpleNamespace(type="text", text=text))
    usage = SimpleNamespace(input_tokens=100, output_tokens=50, cache_read_input_tokens=0, cache_creation_input_tokens=0)
    return SimpleNamespace(content=content, stop_reason=stop_reason, usage=usage, model="fake")


class FakeClient:
    """Stands in for anthropic.AsyncAnthropic; returns queued responses and records requests."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls: list[dict] = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    async def _create(self, **kwargs):
        self.calls.append(kwargs)
        return self.responses.pop(0)
