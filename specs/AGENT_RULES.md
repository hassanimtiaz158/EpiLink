# EpiLink — AGENT_RULES.md
> Instructions for Claude Code / AI coding agents working on this codebase.
> Read this file fully before writing any code, creating any file, or running any command.

---

## Commands

```powershell
pip install -r requirements.txt
pytest tests/ -v                              # all tests (27 total)
pytest tests/test_demo_scenarios.py -v        # 4 demo scenarios
docker compose up --build                     # full stack (PostGIS + API)
alembic upgrade head                          # run DB migrations
```

---

## Project Map

```
epilink/
├── main.py                          # FastAPI app entrypoint, lifespan, router registration
├── core/
│   ├── config.py                    # Pydantic Settings (DATABASE_URL, ENVIRONMENT, webhooks, Twilio)
│   ├── database.py                  # async engine, async_session_factory, get_db dependency
│   └── security.py                  # hash_physician_id(raw_id) → SHA-256 hex string
├── models/
│   ├── disease.py                   # Disease ORM model
│   ├── case_report.py               # CaseReport ORM model
│   ├── alert.py                     # Alert ORM model
│   └── audit_log.py                 # AuditLog ORM model
├── schemas/
│   ├── report.py                    # ReportIn (request), ReportOut (response)
│   ├── alert.py                     # AlertOut, ReviewIn
│   └── dashboard.py                 # DashboardOut
├── services/
│   ├── classifier.py                # DISEASE_ICD10_MAP, GROUP_A/B_CODES, classify_reporting_group()
│   ├── anomaly.py                   # check_cluster_anomaly(), z-score, AlertLevel enum
│   ├── drift.py                     # weekly_drift_check(), recalibrate_seasonal_baseline()
│   ├── sms_parser.py                # parse_sms(body) → ReportIn | None (fixed-position, no NLP)
│   ├── alerts.py                    # dispatch_alert() → Ministry + WHO FHIR webhooks
│   └── privacy.py                   # prepare_global_signal() → anonymised aggregate
├── routers/
│   ├── health.py                    # GET /health
│   ├── report.py                    # POST /api/v1/report
│   ├── sms_webhook.py               # POST /api/v1/sms-webhook (Twilio)
│   ├── alerts.py                    # GET /api/v1/alerts, PATCH /api/v1/alerts/{id}/review
│   └── dashboard.py                 # GET /api/v1/dashboard
├── db/seeds/
│   └── egypt_des_diseases.sql       # 45 diseases: 32 Group A, 13 Group B — mounted as initdb seed
├── alembic/
│   └── versions/001_initial_schema.py
└── tests/
    ├── conftest.py                  # CRITICAL: patches core_database before importing main
    ├── test_classifier.py           # 6 tests
    ├── test_sms_parser.py           # 7 tests
    ├── test_report.py               # 7 tests
    └── test_demo_scenarios.py       # 4 end-to-end demo scenarios
```

---

## Architecture Rules — Read Before Writing Any Code

### Async
- **All DB queries are async.** Use SQLAlchemy 2.0 `async_session` everywhere. Zero sync ORM calls anywhere in the codebase.
- Pattern: `async with async_session() as db:` or inject via `Depends(get_db)`.

### Background Tasks
- **Group A alerts are fire-and-forget.** Use `asyncio.create_task(dispatch_alert(...))` inside the request handler. NEVER `await` the dispatch inside the handler. This keeps API response time under 2 seconds regardless of webhook latency.

### Security
- **`physician_id` must be hashed before ANY DB write.** Call `core.security.hash_physician_id(raw_id)` and store only the hash. The raw ID must never touch the DB, logs, or response payloads.
- Twilio signature validation: call `validate_twilio_signature()` when `settings.ENVIRONMENT != "development"`. Skip in dev/test.

### Epi Week
- **Computed at insert, never user-supplied.** `epi_week = submitted_at.isocalendar()[1]`. Do not accept it from the request body.

### Date Queries in Anomaly Detection
- **No `date_trunc()`.** It is PostgreSQL-only and breaks SQLite in tests. Use Python week-boundary `datetime` objects with `>= / <` range filters in all ORM queries.

### UUID Columns
- Use SQLAlchemy 2.0 `Uuid` type (from `sqlalchemy`), NOT `postgresql.UUID`. This ensures compatibility with both PostgreSQL (prod) and SQLite (tests).

### ICD-10 Collision — B26
- `B26_MU` = Mumps (Group A). `B26` = Viral Hepatitis (Group B).
- The classifier must match on the **full code string** for `_MU` entries. Do not truncate to 3-char prefix before checking Group A/B membership for codes with suffixes.

### Error Responses
- All error responses must use: `{"error": "human readable", "code": "MACHINE_CODE"}`.
- No other error format. No FastAPI default `{"detail": "..."}` leaking through.

---

## Testing Rules — Do Not Violate

### conftest.py patch order
1. Create file-based SQLite engine + session factory
2. Patch `core.database.async_session_factory` with the SQLite factory
3. ONLY THEN import `main` (so background tasks pick up the test DB)
4. Override `get_db` dependency to yield test sessions

**This order is non-negotiable.** Reversing steps 2 and 3 causes background tasks to silently use the real DB (or fail) while the request handler uses the test DB.

### File-based SQLite
- Use `sqlite+aiosqlite:///path/to/test.db` (file path, not `:memory:`).
- In-memory SQLite is per-connection: tables created in connection A are invisible to connection B. Background tasks run in a different connection than the request handler.

### httpx_mock
- Register ALL expected outbound HTTP responses BEFORE the test makes any request.
- `httpx_mock` from `pytest-httpx` intercepts all outbound `httpx` calls globally. Unregistered calls will raise.
- After Group A submissions, include `await asyncio.sleep(0.1)` to allow `create_task` to execute before asserting on webhook calls or alert status in DB.

### AlertOut schema
- `AlertOut.case_report_id` is typed `uuid.UUID`. Pydantic v2 auto-serialises to string. Do not add manual conversion.

---

## Service Contracts

### `services/classifier.py`

```python
# DISEASE_ICD10_MAP: dict[str, str]  — disease name → ICD-10 code (45 entries)
# GROUP_A_CODES: set[str]            — ICD-10 codes triggering immediate alert
# GROUP_B_CODES: set[str]            — ICD-10 codes for weekly aggregate

def validate_icd10(code: str, db: AsyncSession) -> Disease | None: ...
def classify_reporting_group(icd10_code: str) -> Literal["A", "B"]: ...
```

### `services/anomaly.py`

```python
class AlertLevel(Enum):
    HIGH = "HIGH"       # z > 2.5 AND confidence >= 0.85 → auto-dispatch
    REVIEW = "REVIEW"   # z > 2.5 AND confidence < 0.85  → human review
    NORMAL = "NORMAL"   # no action

async def check_cluster_anomaly(
    db: AsyncSession,
    governorate: str,
    icd10_code: str
) -> AlertLevel: ...
```

### `services/sms_parser.py`

```python
# SMS format: RPT#FACILITYID#ICD10CODE#AGEGROUP#SEX#OUTCOME
# Field index: [0]     [1]          [2]         [3]       [4]  [5]
# Returns None on ANY parse failure — never raises

def parse_sms(body: str) -> ReportIn | None: ...
```

Sex normalisation: `M` → `Male`, `F` → `Female`
Outcome normalisation: `ALIVE` → `Alive`, `DEAD` → `Dead`, `UNKNOWN` → `Unknown`

### `services/alerts.py`

```python
# Called via asyncio.create_task — must be a coroutine
# Must NOT raise — wrap each webhook call in try/except

async def dispatch_alert(alert: Alert, db: AsyncSession) -> None: ...
```

### `services/drift.py`

```python
# APScheduler cron: day_of_week='sun', hour=0
# Writes DriftMetric row. POSTs to ADMIN_WEBHOOK_URL if DRIFT_DETECTED.

async def weekly_drift_check(db: AsyncSession) -> dict: ...
```

---

## What This System Is NOT

These misconceptions will cause wrong implementation decisions:

| Wrong assumption | Correct understanding |
|---|---|
| "The classifier uses ML/NLP" | It is a deterministic dict lookup. O(1). No model. |
| "SMS input is free text" | SMS uses fixed-position `#`-delimited fields. No parsing ambiguity. |
| "The anomaly model is an LSTM" | It is a z-score against a pre-computed seasonal baseline. ARIMA-inspired, not deep learning. |
| "physician_id is stored as-is" | It is SHA-256 hashed in `core/security.py` before any DB write. |
| "Patient data crosses borders" | Only anonymised aggregate signals (`icd10_code, age_group, governorate, epi_week, count`) leave the country server. |

---

## Seed Data Reference

File: `db/seeds/egypt_des_diseases.sql` — 45 diseases total.

Key codes used in tests:

| Code | Disease | Group |
|---|---|---|
| A00 | Cholera | A |
| A01.0 | Typhoid fever | B |
| A39.0 | Meningococcal meningitis | A |
| A82 | Rabies | A |
| A90 | Dengue fever | A |
| A98.4 | Ebola | A |
| B04 | Mpox | A |
| B05 | Measles | B |
| B15 | Hepatitis A | B |
| B26 | Viral Hepatitis (other) | B |
| B26_MU | Mumps | A |

---

## Demo Scenarios (must work for judges)

1. **Group A pipeline:** `POST /api/v1/report` (Cholera/A00) → `reporting_group: "A"` → alert dispatched within 60s → appears in `GET /api/v1/alerts`
2. **SMS fallback:** `POST /api/v1/sms-webhook` with `Body=RPT#EGY042#A00#30-59#M#ALIVE` → same alert pipeline as online
3. **Offline sync:** (PWA-level, not backend) — backend just receives normal POST when sync fires
4. **Drift detection:** `weekly_drift_check()` with >15% alert rate → `DRIFT_DETECTED` → admin notified

---

## Deadline

**June 21, 11:59 PM ET.** No extensions.

Day 5 (June 18) = anomaly detection complete.
Day 6 (June 19) = drift + privacy + dashboard complete.
Day 7 (June 20–21) = integration, demo, submission.

If blocked, prioritise in this order: report endpoint → Group A alerts → SMS parser → anomaly detection → drift monitor → dashboard.
