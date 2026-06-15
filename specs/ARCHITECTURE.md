# ARCHITECTURE — EpiLink Backend
**USAII Hackathon 2026**

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (PWA)                        │
│   Structured Form → Local Cache (IndexedDB)             │
│   Offline-first → Background Sync when online           │
└──────────────────────────┬──────────────────────────────┘
                           │  HTTPS POST (online)
                           │  SMS payload (offline fallback)
┌──────────────────────────▼──────────────────────────────┐
│                 API GATEWAY (FastAPI)                    │
│         /report  /sms-webhook  /alerts  /dashboard      │
│                     /health                             │
└──────────────────────────┬──────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
┌─────────────▼──────────┐  ┌──────────▼──────────────────┐
│    Classifier Service   │  │   Anomaly Detection Engine  │
│  Disease → ICD-10 map  │  │   Z-score vs 52-wk baseline │
│  ICD-10 → Group A/B    │  │   Geo-cluster detection      │
│  (deterministic, O(1)) │  │   Confidence scoring         │
└─────────────┬──────────┘  └──────────┬──────────────────┘
              │                         │
┌─────────────▼─────────────────────────▼──────────────────┐
│               PostgreSQL + PostGIS                        │
│   diseases | case_reports | alerts | audit_log            │
│   drift_metrics | baseline_cache                         │
└───────────────────────────┬───────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────┐
│                   ALERT DISPATCHER                        │
│   Ministry Webhook | WHO HL7 FHIR | SMS (Twilio)         │
│   Epidemiologist Dashboard Notification                   │
└───────────────────────────────────────────────────────────┘
```

---

## 2. Component Breakdown

### 2.1 Frontend (PWA — out of backend scope, noted for context)

- Progressive Web App — installable on Android, works in mobile browser
- Service Worker intercepts `/api/v1/report` fetch calls
- On network failure: serialises form payload to IndexedDB, returns `{status: "saved_offline"}` to UI
- Background Sync API: tag `sync-reports` fires when connection detected, drains queue via sequential POSTs
- SMS fallback: UI generates a pre-formatted SMS string (`RPT#...`) for physician to send manually

### 2.2 FastAPI Application (`main.py`)

- Async throughout (Python 3.11+, `asyncio`)
- SQLAlchemy 2.0 async ORM with `asyncpg` (production) / `aiosqlite` (test)
- APScheduler for the weekly drift audit cron job
- Routers: `report`, `alerts`, `dashboard`, `sms_webhook`, `health`
- Background tasks via `asyncio.create_task` — Group A alerts are fire-and-forget, never blocking the request handler

### 2.3 Classifier Service (`services/classifier.py`)

**This is deterministic, not ML.** Input is already structured.

- `DISEASE_ICD10_MAP`: 45-entry dict, disease name → ICD-10 code
- `GROUP_A_CODES` / `GROUP_B_CODES`: sets of ICD-10 prefixes
- `classify_reporting_group(icd10_code)` → `"A"` or `"B"` — O(1) set lookup
- `validate_icd10(code)` → `Disease | None` — checks against `diseases` table

No model, no inference, no uncertainty. Classification is always deterministic.

### 2.4 Anomaly Detection Engine (`services/anomaly.py`)

- Baseline: rolling 52-week historical case counts per `(governorate, icd10_prefix)` pair
- Algorithm: z-score = `(recent_4wk_mean - baseline_mean) / baseline_std`
- Threshold: z > 2.5 standard deviations above baseline
- Confidence: function of baseline data density (more historical data → higher confidence)
- Output:
  - `AlertLevel.HIGH` (z > 2.5 AND confidence ≥ 0.85) → auto-dispatch alert
  - `AlertLevel.REVIEW` (z > 2.5 AND confidence < 0.85) → escalate to epidemiologist
  - `AlertLevel.NORMAL` → no action

### 2.5 SMS Parser (`services/sms_parser.py`)

Fixed-position field parsing. Zero NLP.

```
Format:  RPT#FACILITYID#ICD10CODE#AGEGROUP#SEX#OUTCOME
Example: RPT#EGY042#A90#15-29#M#ALIVE

Field positions (split on #):
  [0] = "RPT" (command prefix, validated)
  [1] = facility_id
  [2] = icd10_code
  [3] = age_group
  [4] = sex (M/F)
  [5] = outcome (ALIVE/DEAD/UNKNOWN)
```

Parser returns a `ReportSchema`-compatible dict, then follows identical pipeline as online submission.

Twilio signature validation: enforced in production (`ENVIRONMENT != "development"`), skipped in dev/test.

### 2.6 Alert Dispatcher (`services/alerts.py`)

Dispatches to three targets via HTTP POST (intercepted by `pytest-httpx` in tests):

- **Ministry webhook**: `POST {MINISTRY_WEBHOOK_URL}` with JSON alert payload
- **WHO HL7 FHIR**: `POST {WHO_FHIR_URL}/Bundle` with FHIR-formatted bundle
- **Admin notification** (drift only): `POST {ADMIN_WEBHOOK_URL}`

All dispatch calls are wrapped in try/except — failure to reach external endpoint does not fail the alert record creation.

### 2.7 Drift Monitor (`services/drift.py`)

APScheduler cron: Sunday 00:00 UTC.

Metrics computed:
1. `alert_rate` — alerts / reports for the past week. Flag `DRIFT_DETECTED` if outside `[0.005, 0.15]`
2. `mean_confidence` — mean confidence score across all anomaly checks past week
3. `human_confirmation_rate` — of `REVIEW`-level alerts resolved by epidemiologist, % confirmed vs dismissed. Target ≥ 70%
4. Quarterly: recalibrate seasonal baseline on rolling 3-year window

---

## 3. Data Flow: Report Submission (Online)

```
1. Physician selects disease → ICD-10 auto-filled in form
2. Physician submits form → POST /api/v1/report
3. FastAPI validates ICD-10 against diseases table
4. classify_reporting_group() → "A" or "B"
5. physician_id SHA-256 hashed (core/security.py)
6. CaseReport written to DB (epi_week computed at insert)
7. check_cluster_anomaly(governorate, icd10) called
   → z-score computed → AlertLevel determined
   → If HIGH/REVIEW: Alert record created
8. If Group A AND HIGH: asyncio.create_task(dispatch_alert())
   → Ministry webhook + WHO FHIR (fire-and-forget)
9. Response: {status: "received", report_id: <uuid>}
```

---

## 4. Data Flow: Offline → Sync

```
1. Physician submits form (offline)
2. Service Worker catches failed fetch
3. Payload serialised to IndexedDB queue
4. UI shows "Saved locally — will sync when connected"
5. Connection returns → Background Sync fires (tag: "sync-reports")
6. syncOfflineReports() drains IndexedDB queue
7. Each pending report POSTed to /api/v1/report sequentially
8. On 200: removed from queue. On failure: retried next sync.
```

---

## 5. Privacy Architecture

```
Country-level server (stays local):
├── Raw case_reports table (with facility_id)
├── physician_id (SHA-256 hashed — never raw)
└── Full audit_log

EpiLink global server (receives only):
├── icd10_code
├── age_group (bracket, not exact age)
├── governorate (region, not address)
├── epi_week
└── count per week

NEVER transmitted cross-border:
✗ patient name
✗ physician identity
✗ facility address
✗ exact date of birth
✗ raw case_report rows
```

---

## 6. Technology Stack

| Layer | Technology |
|---|---|
| API Framework | FastAPI (Python 3.11) |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 15 + PostGIS 3 |
| DB Driver (prod) | asyncpg |
| DB Driver (test) | aiosqlite |
| Migrations | Alembic |
| SMS Gateway | Twilio |
| Scheduler | APScheduler |
| Containerisation | Docker + Docker Compose |
| Testing | pytest + pytest-asyncio + pytest-httpx |
| HTTP Client | httpx (async) |

---

## 7. Key Design Rules

- **All DB queries async** — SQLAlchemy 2.0 `async_session` throughout. No sync ORM calls.
- **Group A alerts are fire-and-forget** — `asyncio.create_task()`, never `await`ed inside the request handler. Latency of dispatch does not affect API response time.
- **`physician_id` hashed before write** — `core/security.py` SHA-256s the raw ID. Raw ID never touches the DB.
- **Epi week computed at insert** — `submitted_at.isocalendar()[1]`. Not user-supplied.
- **No `date_trunc`** — Anomaly queries use Python week-boundary `>= / <` ranges for SQLite compatibility in tests.
- **UUID columns** — SQLAlchemy 2.0 `Uuid` type (not `postgresql.UUID`), compatible with both PostgreSQL and SQLite.
- **ICD-10 `B26_MU`** — Mumps (Group A). `B26` alone = Viral Hepatitis (Group B). The `_MU` suffix prevents collision in the lookup map.
