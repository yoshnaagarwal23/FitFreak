from fastapi.testclient import TestClient

from app.main import app, get_planner
from app.meal_plan.planner import MealPlanner

from .conftest import FOODS, GOOD, FakeClient, response

client = TestClient(app)

BODY = {
    "targets": {"calories": 1125, "protein": 49.4, "carbs": 157, "fat": 32.6},
    "foods": [f.model_dump() for f in FOODS],
    "meals": ["lunch", "dinner"],
    "vegetarian": True,
    "notes": "",
}


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_meal_plan_endpoint():
    app.dependency_overrides[get_planner] = lambda: MealPlanner(FakeClient([response(GOOD)]))
    try:
        r = client.post("/meal-plan", json=BODY, headers={"Origin": "http://localhost:8081"})
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "http://localhost:8081"
    data = r.json()
    assert [m["meal"] for m in data["meals"]] == ["lunch", "dinner"]
    assert data["within_tolerance"] is True


def test_planner_failure_is_502_with_message():
    app.dependency_overrides[get_planner] = lambda: MealPlanner(FakeClient([response("x"), response("y")]))
    try:
        r = client.post("/meal-plan", json=BODY)
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 502 and "valid plan" in r.json()["detail"]


def test_bad_requests_rejected():
    app.dependency_overrides[get_planner] = lambda: MealPlanner(FakeClient([]))
    for patch in (
        {"meals": ["lunch", "lunch"]},
        {"meals": []},
        {"foods": []},
        {"targets": {**BODY["targets"], "calories": 0}},
        {"notes": "x" * 301},
    ):
        assert client.post("/meal-plan", json={**BODY, **patch}).status_code == 422, patch
    app.dependency_overrides.clear()


def test_missing_api_key_is_503(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    get_planner.cache_clear()
    r = client.post("/meal-plan", json=BODY)
    assert r.status_code == 503 and "ANTHROPIC_API_KEY" in r.json()["detail"]
