# TEST_PLAN — EpiLink
**Target: 27 tests total | `pytest tests/ -v`**

---

## Test Infrastructure

### Stack
- `pytest` + `pytest-asyncio` — async test support
- `pytest-httpx` (`httpx_mock` fixture) — intercepts ALL outbound HTTP (Ministry, WHO, admin webhooks)
- `aiosqlite` — async SQLite for test DB (no PostgreSQL in CI)
- `httpx.AsyncClient` — test client for FastAPI

### `tests/conftest.py` — Critical Setup

**The patch order matters.** `async_session_factory` must be patched before `main` is imported, because background tasks reference `core_db.async_session_factory` via module attribute lookup at runtime.

```python
# conftest.py — required pattern
import tempfile, os, pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# 1. Create file-based SQLite (NOT :memory: — tables would be invisible across connections)
@pytest.fixture(scope="session")
def db_path(tmp_path_factory):
    return str(tmp_path_factory.mktemp("db") / "test.db")

@pytest.fixture(scope="session", autouse=True)
def patch_db(db_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    # Patch BEFORE importing main
    import core.database as core_db
    core_db.async_session_factory = session_factory

    # Now import main (it will pick up the patched factory)
    from main import app
    return app

@pytest_asyncio.fixture
async def async_client(patch_db):
    async with AsyncClient(app=patch_db, base_url="http://test") as client:
        yield client
```

**Why file-based SQLite?** In-memory SQLite is per-connection: tables created in one connection are invisible to another. File-based shares state across all connections in the test session.

**Why patch before import?** Background tasks call `core_db.async_session_factory()` at execution time, not import time. Patching the module attribute after the fact still works because Python resolves it at call time via the module reference.

---

## Test Files

### `tests/test_classifier.py` (6 tests)

Tests `services/classifier.py` in isolation — no DB required.

| Test | Assertion |
|---|---|
| `test_group_a_cholera` | `classify_reporting_group("A00") == "A"` |
| `test_group_a_rabies` | `classify_reporting_group("A82") == "A"` |
| `test_group_b_typhoid` | `classify_reporting_group("A01.0") == "B"` |
| `test_group_b_hepatitis_a` | `classify_reporting_group("B15") == "B"` |
| `test_mumps_suffix_collision` | `classify_reporting_group("B26_MU") == "A"` — Mumps is Group A |
| `test_viral_hepatitis_b26` | `classify_reporting_group("B26") == "B"` — B26 without suffix is Group B |

**Edge case:** `B26_MU` vs `B26` — the `_MU` suffix must be preserved in lookup. The first 3 chars of `B26_MU` are `B26`, which is Group B. The classifier must match on the full code string for `_MU` entries, not the prefix. Verify this doesn't regress.

---

### `tests/test_sms_parser.py` (7 tests)

Tests `services/sms_parser.py` in isolation — pure function, no DB.

| Test | Input | Expected |
|---|---|---|
| `test_valid_sms_parse` | `RPT#EGY042#A39.0#15-29#M#ALIVE` | `ReportIn` with correct fields |
| `test_sex_m_normalised` | `...#M#...` | `sex == "Male"` |
| `test_sex_f_normalised` | `...#F#...` | `sex == "Female"` |
| `test_outcome_dead` | `...#DEAD` | `outcome == "Dead"` |
| `test_outcome_unknown` | `...#UNKNOWN` | `outcome == "Unknown"` |
| `test_missing_field_returns_none` | `RPT#EGY042#A39.0#15-29#M` (5 fields) | returns `None` |
| `test_wrong_prefix_returns_none` | `MSG#EGY042#A39.0#15-29#M#ALIVE` | returns `None` |

---

### `tests/test_report.py` (7 tests)

Tests `POST /api/v1/report` end-to-end via `async_client`. Uses `httpx_mock` to intercept webhook calls.

| Test | Scenario | Expected |
|---|---|---|
| `test_report_group_b_success` | Valid Group B report (Hepatitis A, B15) | 201, `alert_triggered: false` |
| `test_report_group_a_success` | Valid Group A report (Cholera, A00) | 201, `reporting_group: "A"`, `alert_triggered: true` |
| `test_report_group_a_webhook_fired` | Group A report + `httpx_mock` | Ministry webhook receives POST within test |
| `test_invalid_icd10` | `icd10_code: "Z99.999"` | 400, `code: "INVALID_ICD10"` |
| `test_invalid_age_group` | `age_group: "25"` | 422 validation error |
| `test_physician_id_hashed` | Submit report, query DB | `physician_id` in DB is SHA-256 hash, not raw value |
| `test_epi_week_computed` | Submit report on known date | `epi_week` in DB matches `submitted_at.isocalendar()[1]` |

**`httpx_mock` setup for webhook test:**
```python
def test_report_group_a_webhook_fired(async_client, httpx_mock):
    httpx_mock.add_response(url=settings.MINISTRY_WEBHOOK_URL, method="POST", status_code=200)
    httpx_mock.add_response(url=settings.WHO_FHIR_URL + "/Bundle", method="POST", status_code=201)

    response = await async_client.post("/api/v1/report", json={...cholera_payload...})
    assert response.status_code == 201
    # Give background task time to fire
    await asyncio.sleep(0.1)
    assert len(httpx_mock.get_requests()) == 2
```

---

### `tests/test_demo_scenarios.py` (4 tests)

End-to-end integration scenarios mirroring the judge demo. All use `httpx_mock`.

#### Scenario 1 — Group A Immediate Alert Pipeline

```
POST /api/v1/report  (Cholera, A00, Cairo)
→ 201 received
→ GET /api/v1/alerts
→ Alert with status "dispatched" exists
→ Ministry webhook was called
```

```python
async def test_scenario_1_group_a_alert_pipeline(async_client, httpx_mock):
    httpx_mock.add_response(url=..., method="POST", status_code=200)  # ministry
    httpx_mock.add_response(url=..., method="POST", status_code=201)  # who fhir

    r = await async_client.post("/api/v1/report", json=cholera_payload)
    assert r.status_code == 201
    assert r.json()["reporting_group"] == "A"
    assert r.json()["alert_triggered"] == True

    await asyncio.sleep(0.1)  # let background task run

    alerts = await async_client.get("/api/v1/alerts?icd10_code=A00")
    assert alerts.json()["total"] >= 1
    assert alerts.json()["alerts"][0]["status"] == "dispatched"
```

#### Scenario 2 — SMS Fallback Pipeline

```
POST /api/v1/sms-webhook  Body=RPT#EGY042#A00#30-59#M#ALIVE
→ 200 TwiML
→ GET /api/v1/alerts
→ Same alert pipeline triggered as online submission
```

```python
async def test_scenario_2_sms_fallback(async_client, httpx_mock):
    httpx_mock.add_response(...)  # webhooks

    r = await async_client.post(
        "/api/v1/sms-webhook",
        data={"Body": "RPT#EGY042#A00#30-59#M#ALIVE", "From": "+201012345678"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert r.status_code == 200
    assert "Report received" in r.text

    await asyncio.sleep(0.1)
    reports = await async_client.get("/api/v1/alerts")
    assert reports.json()["total"] >= 1
```

#### Scenario 3 — Anomaly Cluster Detection

```
POST /api/v1/report × 8  (same disease, same governorate, rapid succession)
→ z-score spikes above threshold
→ Alert created with level HIGH
→ GET /api/v1/alerts → HIGH alert present
```

```python
async def test_scenario_3_anomaly_cluster(async_client, httpx_mock):
    httpx_mock.add_response(...)

    for _ in range(8):
        await async_client.post("/api/v1/report", json=meningitis_cairo_payload)

    await asyncio.sleep(0.2)

    alerts = await async_client.get("/api/v1/alerts?alert_level=HIGH")
    assert alerts.json()["total"] >= 1
```

#### Scenario 4 — Drift Detection + Admin Notification

```
Manually invoke weekly_drift_check with seeded high alert rate
→ DriftMetric row written with status DRIFT_DETECTED
→ Admin webhook called
```

```python
async def test_scenario_4_drift_detection(async_client, httpx_mock):
    httpx_mock.add_response(url=settings.ADMIN_WEBHOOK_URL, method="POST", status_code=200)

    # Seed: 50 reports, 40 alerts (80% alert rate — above 15% threshold)
    # ... seed setup ...

    from services.drift import weekly_drift_check
    async with get_test_db() as db:
        metrics = await weekly_drift_check(db)

    assert metrics["alert_rate_status"] == "DRIFT_DETECTED"
    assert len(httpx_mock.get_requests(url=settings.ADMIN_WEBHOOK_URL)) == 1
```

---

## Running Tests

```powershell
# All 27 tests
pytest tests/ -v

# Demo scenarios only
pytest tests/test_demo_scenarios.py -v

# Specific file
pytest tests/test_classifier.py -v

# With coverage
pytest tests/ -v --cov=. --cov-report=term-missing
```

---

## Test Count Summary

| File | Tests |
|---|---|
| `test_classifier.py` | 6 |
| `test_sms_parser.py` | 7 |
| `test_report.py` | 7 |
| `test_demo_scenarios.py` | 4 |
| `test_alerts.py` (review endpoint) | 3 |
| **Total** | **27** |

---

## Known Quirks (Do Not Change)

- `httpx_mock` from `pytest-httpx` intercepts ALL outbound HTTP. Register ALL expected responses before the test makes any request.
- `AlertOut.case_report_id` is typed `uuid.UUID` in Pydantic — Pydantic v2 auto-serialises to string in JSON response. Do not add manual `.str()` conversion.
- `asyncio.sleep(0.1)` after Group A submissions is required in tests to let `create_task` background tasks execute before asserting on webhook calls or alert status.
- Never use `:memory:` SQLite in tests. Tables created in one connection are invisible to another. Use the file-based fixture from `conftest.py`.
- Do not import `main` before patching `core_database.async_session_factory`. This will cause background tasks to reference the real DB, not the test DB.
