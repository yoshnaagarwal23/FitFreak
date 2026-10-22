"""Request/response models for the meal planner, plus the schema Claude must follow."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Meal = Literal["breakfast", "lunch", "snack", "dinner"]
MEAL_ORDER: tuple[Meal, ...] = ("breakfast", "lunch", "snack", "dinner")


class Macros(BaseModel):
    calories: float = Field(ge=0)
    protein: float = Field(ge=0)
    carbs: float = Field(ge=0)
    fat: float = Field(ge=0)


# ---- Request (from the app) ----


class FoodIn(BaseModel):
    """A food from the app's database. Values are per 100 g."""

    id: int
    name: str = Field(min_length=1, max_length=120)
    serving_label: str = Field(max_length=60)
    serving_grams: float = Field(gt=0, le=2000)
    per_100g: Macros
    vegetarian: bool


class MealPlanRequest(BaseModel):
    targets: Macros
    foods: list[FoodIn] = Field(min_length=1, max_length=500)
    meals: list[Meal] = Field(min_length=1, max_length=4)
    vegetarian: bool = True
    notes: str = Field(default="", max_length=300)

    @field_validator("targets")
    @classmethod
    def calories_positive(cls, v: Macros) -> Macros:
        if not 0 < v.calories <= 10000:
            raise ValueError("targets.calories must be between 1 and 10000")
        return v

    @field_validator("meals")
    @classmethod
    def unique_meals(cls, v: list[Meal]) -> list[Meal]:
        if len(set(v)) != len(v):
            raise ValueError("meals must not repeat")
        return sorted(v, key=MEAL_ORDER.index)


# ---- What Claude returns (validated before use) ----


class LlmItem(BaseModel):
    food_id: int
    grams: float


class LlmMeal(BaseModel):
    meal: Meal
    name: str
    items: list[LlmItem]
    instructions: str


class LlmPlan(BaseModel):
    meals: list[LlmMeal]
    notes: str


# JSON schema for structured outputs. Kept in step with LlmPlan (checked by tests).
LLM_PLAN_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "meals": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "meal": {"type": "string", "enum": list(MEAL_ORDER)},
                    "name": {"type": "string"},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "food_id": {"type": "integer"},
                                "grams": {"type": "number"},
                            },
                            "required": ["food_id", "grams"],
                            "additionalProperties": False,
                        },
                    },
                    "instructions": {"type": "string"},
                },
                "required": ["meal", "name", "items", "instructions"],
                "additionalProperties": False,
            },
        },
        "notes": {"type": "string"},
    },
    "required": ["meals", "notes"],
    "additionalProperties": False,
}


# ---- Response (to the app) ----


class PlanItem(BaseModel):
    food_id: int
    food_name: str
    grams: float
    macros: Macros


class PlanMeal(BaseModel):
    meal: Meal
    name: str
    instructions: str
    items: list[PlanItem]
    totals: Macros


class MealPlanResponse(BaseModel):
    meals: list[PlanMeal]
    totals: Macros
    targets: Macros
    # (actual - target) / target for each macro, e.g. 0.05 = 5% over.
    deviation: dict[str, float]
    within_tolerance: bool
    notes: str
    attempts: int
