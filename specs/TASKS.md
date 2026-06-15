# TASKS — EpiLink Development Plan
**Deadline: June 21, 11:59 PM ET | 7 days from June 14**

Status legend: `[ ]` todo · `[x]` done · `[~]` in progress · `[!]` blocked

---

## Day 1–2 (June 14–15) — Foundation

### Project Setup
- [x] FastAPI project scaffold (`main.py`, `core/`, `models/`, `schemas/`, `services/`, `routers/`)
- [x] `core/config.py` — Pydantic Settings, env vars (`DATABASE_URL`, `ENVIRONMENT`, `TWILIO_*`, `MINISTRY_WEBHOOK_URL`, `WHO_FHIR_URL`, `ADMIN_WEBHOOK_URL`)
- [x] `core/database.py` — SQLAlchemy 2.0 async engine, `async_session_factory`, `get_db` dependency
- [x] `core/security.py` — SHA-256 `hash_physician_id(raw_id: str) -> str`
- [x] `docker-compose.yml` — PostgreSQL 15 + PostGIS 3 service, API service, volume mount for seed SQL
- [x] `requirements.txt` — fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, aiosqlite, alembic, httpx, apscheduler, twilio, pytest, pytest-asyncio, pytest-httpx

### Database
- [x] Alembic init + `alembic/versions/001_initial_schema.py`
  - [x] `diseases` table
  - [x] `case_reports` table (with all constraints from DATABASE.md)
  - [x] `alerts` table
  - [x] `audit_log` table
  - [x] `drift_metrics` table
  - [x] `baseline_cache` table
  - [x] All indexes
- [x] `db/seeds/egypt_des_diseases.sql` — 45 diseases, 32 Group A, 13 Group B
- [x] Verified seed mounts as `docker-entrypoint-initdb.d/01_seed.sql`

### Models (SQLAlchemy 2.0)
- [x] `models/disease.py` — `Disease` ORM model
- [x] `models/case_report.py` — `CaseReport` ORM model
- [x] `models/alert.py` — `Alert` ORM model
- [x] `models/audit_log.py` — `AuditLog` ORM model

### Schemas (Pydantic v2)
- [x] `schemas/report.py` — `ReportIn`, `ReportOut`
- [x] `schemas/alert.py` — `AlertOut`, `ReviewIn`
- [x] `schemas/dashboard.py` — `DashboardOut`

### Classifier Service
- [x] `services/classifier.py`
  - [x] `DISEASE_ICD10_MAP` dict (45 entries)
  - [x] `GROUP_A_CODES` set, `GROUP_B_CODES` set
  - [x] `validate_icd10(code, db) -> Disease | None`
  - [x] `classify_reporting_group(icd10_code) -> str` — O(1) set lookup

### Report Router
- [x] `routers/report.py` — `POST /api/v1/report`
  - [x] Validate ICD-10 against DB
  - [x] Classify Group A/B
  - [x] Hash physician_id
  - [x] Compute epi_week at insert
  - [x] Write `CaseReport` to DB
  - [x] Fire-and-forget alert task for Group A: `asyncio.create_task(...)`
  - [x] Call `check_cluster_anomaly` (awaited, but internal)
  - [x] Return `{status, report_id, reporting_group, alert_triggered}`

### Health Router
- [x] `routers/health.py` — `GET /health`

### Tests (Day 1–2)
- [x] `tests/conftest.py`
  - [x] Patch `core_database.async_session_factory` BEFORE importing `main`
  - [x] File-based SQLite temp DB (not `:memory:`)
  - [x] `async_client` fixture (httpx AsyncClient)
- [x] `tests/test_classifier.py` — ICD-10 validation, Group A/B classification, B26_MU edge case
- [x] `tests/test_report.py` — Happy path, invalid ICD-10, validation errors, Group A alert trigger

---

## Day 3–4 (June 16–17) — Offline + SMS

### SMS Parser
- [ ] `services/sms_parser.py`
  - [ ] `parse_sms(body: str) -> ReportIn | None`
  - [ ] Fixed-position split on `#`
  - [ ] Field mapping: `RPT[0]#facility[1]#icd10[2]#age_group[3]#sex[4]#outcome[5]`
  - [ ] Sex normalisation: `M` → `Male`, `F` → `Female`
  - [ ] Outcome normalisation: `ALIVE` → `Alive`, `DEAD` → `Dead`, `UNKNOWN` → `Unknown`
  - [ ] Return `None` on any parse failure (not raise)

### SMS Webhook Router
- [ ] `routers/sms_webhook.py` — `POST /api/v1/sms-webhook`
  - [ ] Twilio signature validation (enforce when `ENVIRONMENT=production`, skip in dev)
  - [ ] Call `parse_sms(body)` → 400 TwiML on None
  - [ ] Set `submission_mode = "sms-fallback"`
  - [ ] Reuse same report insertion + alert pipeline as `/api/v1/report`
  - [ ] Return TwiML `<Response><Message>...</Message></Response>`

### Tests (Day 3–4)
- [ ] `tests/test_sms_parser.py`
  - [ ] Valid SMS → correct ReportIn fields
  - [ ] M/F normalisation
  - [ ] ALIVE/DEAD/UNKNOWN normalisation
  - [ ] Missing field → returns None
  - [ ] Wrong prefix (`MSG#...`) → returns None
  - [ ] Invalid ICD-10 code in SMS → rejected at router level

---

## Day 5 (June 18) — Anomaly Detection

### Anomaly Service
- [ ] `services/anomaly.py`
  - [ ] `get_recent_cases(db, governorate, icd10, weeks=4) -> list[int]` — weekly counts, Python `>= / <` bounds (no `date_trunc`)
  - [ ] `get_seasonal_baseline(db, governorate, icd10, epi_week) -> BaselineStat` — from `baseline_cache`, fallback to computing from `case_reports`
  - [ ] `calculate_z_score(recent_mean, baseline_mean, baseline_std) -> float`
  - [ ] `calculate_confidence(data_points: int) -> float` — sigmoid on data density
  - [ ] `check_cluster_anomaly(db, governorate, icd10_code) -> AlertLevel`
    - [ ] `HIGH` if z > 2.5 AND confidence ≥ 0.85 → create Alert record, set status `pending`
    - [ ] `REVIEW` if z > 2.5 AND confidence < 0.85 → create Alert record, set status `under_review`
    - [ ] `NORMAL` → no action

### Alert Dispatcher
- [ ] `services/alerts.py`
  - [ ] `dispatch_alert(alert: Alert, db)` — called via `asyncio.create_task`
    - [ ] POST to `MINISTRY_WEBHOOK_URL` with JSON payload
    - [ ] POST to `WHO_FHIR_URL/Bundle` with HL7 FHIR bundle
    - [ ] Update alert `status = "dispatched"`, `dispatched_at = now()`
    - [ ] Update `dispatch_targets` JSONB field
    - [ ] Wrap each call in try/except — log failure, do not raise

### Alert Router
- [ ] `routers/alerts.py`
  - [ ] `GET /api/v1/alerts` — filters: governorate, status, icd10_code, alert_level, limit, offset
  - [ ] `PATCH /api/v1/alerts/{id}/review`
    - [ ] Validate alert exists → 404
    - [ ] Validate not already reviewed → 409
    - [ ] Write decision + timestamps
    - [ ] If `confirmed` + not yet dispatched → trigger dispatch

---

## Day 6 (June 19) — Drift Monitoring + Privacy + Dashboard

### Drift Monitor
- [ ] `services/drift.py`
  - [ ] `weekly_drift_check(db)` — APScheduler cron, Sunday 00:00 UTC
    - [ ] Compute `alert_rate` for past week
    - [ ] Flag `DRIFT_DETECTED` if outside `[0.005, 0.15]`
    - [ ] Compute `mean_confidence` across all anomaly checks
    - [ ] Compute `human_confirmation_rate` from reviewed REVIEW-level alerts
    - [ ] Quarterly: `recalibrate_seasonal_baseline(db)` if `is_quarter_end()`
    - [ ] Write `DriftMetric` row
    - [ ] If DRIFT_DETECTED: `POST {ADMIN_WEBHOOK_URL}` with metrics payload

### Privacy / Anonymisation
- [ ] `services/privacy.py`
  - [ ] `prepare_global_signal(case: CaseReport) -> GlobalSignal`
    - [ ] Include: `icd10_code`, `reporting_group`, `governorate`, `age_group`, `epi_week`
    - [ ] Exclude: `physician_id`, `facility_id`, `district`, `symptom_onset_date`, `outcome`

### Dashboard Router
- [ ] `routers/dashboard.py` — `GET /api/v1/dashboard`
  - [ ] Weekly report counts (total, Group A, Group B)
  - [ ] Alert rate + drift status from latest `drift_metrics` row
  - [ ] Top 5 diseases by case count this week
  - [ ] Recent 10 alerts with status
  - [ ] `pending_reviews` count

### Register APScheduler
- [ ] Wire APScheduler into `main.py` lifespan event
- [ ] Job: `weekly_drift_check`, cron `day_of_week='sun', hour=0`

---

## Day 7 (June 20–21) — Integration + Demo Prep

### Integration
- [ ] Connect frontend PWA form to `POST /api/v1/report` (CORS config in FastAPI)
- [ ] Verify Service Worker offline queue drains correctly on reconnect
- [ ] End-to-end smoke test: form submit → DB → alert → webhook

### Demo Scenarios (must pass before submission)
- [ ] **Scenario 1:** Doctor submits Cholera (A00) → Group A → alert dispatched within 60s
- [ ] **Scenario 2:** Offline submission queued → reconnect → auto-sync → report appears in DB
- [ ] **Scenario 3:** SMS `RPT#EGY042#A00#30-59#M#ALIVE` → parsed → same pipeline as online
- [ ] **Scenario 4 (drift):** Manually trigger `weekly_drift_check` with fabricated high alert rate → admin notified

### Final Tests
- [ ] All 27 tests passing: `pytest tests/ -v`
- [ ] 4 demo scenario tests passing: `pytest tests/test_demo_scenarios.py -v`
- [ ] `docker compose up --build` → full stack healthy

### Submission Checklist
- [ ] Devpost submission form completed
- [ ] GitHub repo public with README
- [ ] Demo video recorded (Scenario 1 + 2 minimum)
- [ ] Judge-facing weakness answers included in README/Devpost
- [ ] `AGENT_RULES.md` up to date for any last-minute Claude Code usage
