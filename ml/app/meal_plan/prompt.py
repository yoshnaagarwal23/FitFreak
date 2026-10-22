"""Prompt text for the meal planner."""

from .nutrition import MACRO_KEYS, TOLERANCE
from .schemas import Macros, MealPlanRequest

INSTRUCTIONS = """You plan a day of meals for a fitness app whose users are mostly vegetarian and \
Indian. You choose foods and portion sizes; the app computes the nutrition itself from its own \
database, so pick grams carefully — the totals it calculates are what the user sees.

How to build the plan:
- Use only foods from the food list, referenced by their id. Never invent a food or an id.
- Compose meals people actually eat together: dal with rice or roti, paneer with roti, poha or \
idli for breakfast, curd on the side. Each meal should be something a home cook could make.
- Use realistic portions. Prefer whole servings where natural (e.g. 2 or 3 rotis rather than \
1.37 rotis' worth of grams); grams must be between 5 and 1000 per item.
- Hit the daily targets for the meals requested. Calories and protein matter most \
(within 10%); carbs and fat should be within 20%. Do the arithmetic from the per-100 g \
values before answering.
- If the user is vegetarian, use only foods marked veg.
- `name` is a short dish name. `instructions` is 1–3 plain sentences on how to prepare it.
- `notes` is one or two sentences about the plan (e.g. where the protein comes from).
- The user's notes describe preferences and constraints; follow them where the food list allows, \
and say in `notes` if one couldn't be met."""


def food_list(req: MealPlanRequest) -> str:
    lines = ["id | name | veg | typical serving | per 100 g: kcal, protein g, carbs g, fat g"]
    for f in req.foods:
        if req.vegetarian and not f.vegetarian:
            continue
        p = f.per_100g
        lines.append(
            f"{f.id} | {f.name} | {'veg' if f.vegetarian else 'non-veg'} | "
            f"{f.serving_label} = {f.serving_grams:g} g | "
            f"{p.calories:g}, {p.protein:g}, {p.carbs:g}, {p.fat:g}"
        )
    return "\n".join(lines)


def system_prompt(req: MealPlanRequest) -> str:
    # Instructions and food list are stable across a user's requests, so they form the cached prefix.
    return f"{INSTRUCTIONS}\n\n<food_list>\n{food_list(req)}\n</food_list>"


def _fmt(m: Macros) -> str:
    return f"{m.calories:.0f} kcal, protein {m.protein:.0f} g, carbs {m.carbs:.0f} g, fat {m.fat:.0f} g"


def request_message(req: MealPlanRequest) -> str:
    parts = [
        f"Targets for these meals combined: {_fmt(req.targets)}.",
        f"Meals to plan: {', '.join(req.meals)}.",
        f"Vegetarian: {'yes' if req.vegetarian else 'no'}.",
    ]
    if req.notes.strip():
        parts.append(f"<user_notes>\n{req.notes.strip()}\n</user_notes>")
    return "\n".join(parts)


def repair_message(issues: list[str], totals: Macros | None, dev: dict[str, float] | None, target: Macros) -> str:
    lines = ["The app checked your plan."]
    if issues:
        lines.append("It broke these rules:")
        lines.extend(f"- {i}" for i in issues)
    if totals is not None and dev is not None:
        lines.append(f"Computed totals: {_fmt(totals)} (targets: {_fmt(target)}).")
        off = [f"{k} {dev[k]:+.0%} (allowed ±{TOLERANCE[k]:.0%})" for k in MACRO_KEYS if abs(dev[k]) > TOLERANCE[k]]
        if off:
            lines.append("Off target: " + ", ".join(off) + ".")
    lines.append("Return a corrected plan in the same format. Adjust grams or swap foods as needed.")
    return "\n".join(lines)
