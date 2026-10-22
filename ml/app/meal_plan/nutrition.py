"""Deterministic nutrition math and plan validation. No AI calls here.

Claude only chooses foods and grams; every number the app shows is computed here
from the app's own food data.
"""

from .schemas import FoodIn, LlmPlan, Macros, MealPlanRequest, PlanItem, PlanMeal

MIN_ITEM_GRAMS = 5
MAX_ITEM_GRAMS = 1000

# How far each macro may drift from target and still count as "on target".
TOLERANCE = {"calories": 0.10, "protein": 0.10, "carbs": 0.20, "fat": 0.20}

MACRO_KEYS = ("calories", "protein", "carbs", "fat")


def macros_for(food: FoodIn, grams: float) -> Macros:
    f = grams / 100
    p = food.per_100g
    return Macros(calories=p.calories * f, protein=p.protein * f, carbs=p.carbs * f, fat=p.fat * f)


def sum_macros(items: list[Macros]) -> Macros:
    return Macros(**{k: sum(getattr(m, k) for m in items) for k in MACRO_KEYS})


def deviation(actual: Macros, target: Macros) -> dict[str, float]:
    """Relative difference per macro. A zero target counts any intake over 1 g/kcal as 100% off."""
    out: dict[str, float] = {}
    for k in MACRO_KEYS:
        t, a = getattr(target, k), getattr(actual, k)
        out[k] = (a - t) / t if t > 0 else (0.0 if a < 1 else 1.0)
    return out


def within_tolerance(dev: dict[str, float]) -> bool:
    return all(abs(dev[k]) <= TOLERANCE[k] for k in MACRO_KEYS)


def error_score(dev: dict[str, float]) -> float:
    """Lower is better; used to pick the best attempt. Calories and protein weigh double."""
    weights = {"calories": 2.0, "protein": 2.0, "carbs": 1.0, "fat": 1.0}
    return sum(weights[k] * abs(dev[k]) for k in MACRO_KEYS)


class PlanIssues(Exception):
    """The model's plan broke a hard rule. `issues` are fed back to it on retry."""

    def __init__(self, issues: list[str]):
        super().__init__("; ".join(issues))
        self.issues = issues


def build_plan(plan: LlmPlan, req: MealPlanRequest) -> list[PlanMeal]:
    """Checks the model's plan against the request and computes all macros.

    Raises PlanIssues listing every rule the plan broke.
    """
    foods = {f.id: f for f in req.foods}
    issues: list[str] = []

    slots = [m.meal for m in plan.meals]
    if sorted(slots) != sorted(req.meals):
        issues.append(f"Plan must contain exactly these meals once each: {', '.join(req.meals)} (got {', '.join(slots) or 'none'}).")

    meals: list[PlanMeal] = []
    for m in plan.meals:
        if not m.items:
            issues.append(f"{m.meal} has no items.")
        items: list[PlanItem] = []
        for it in m.items:
            food = foods.get(it.food_id)
            if food is None:
                issues.append(f"{m.meal}: food_id {it.food_id} is not in the food list.")
                continue
            if req.vegetarian and not food.vegetarian:
                issues.append(f"{m.meal}: {food.name} is not vegetarian.")
            if not MIN_ITEM_GRAMS <= it.grams <= MAX_ITEM_GRAMS:
                issues.append(f"{m.meal}: {food.name} at {it.grams:g} g is outside {MIN_ITEM_GRAMS}–{MAX_ITEM_GRAMS} g.")
            grams = round(it.grams, 1)
            items.append(PlanItem(food_id=food.id, food_name=food.name, grams=grams, macros=macros_for(food, grams)))
        meals.append(
            PlanMeal(
                meal=m.meal,
                name=m.name.strip()[:120],
                instructions=m.instructions.strip()[:800],
                items=items,
                totals=sum_macros([i.macros for i in items]),
            )
        )

    if issues:
        raise PlanIssues(issues)
    meals.sort(key=lambda pm: req.meals.index(pm.meal))
    return meals
