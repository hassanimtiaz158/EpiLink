# DATABASE — EpiLink Schema
**PostgreSQL 15 + PostGIS 3 | Alembic migration: `001_initial_schema.py`**

---

## 1. Tables Overview

| Table | Purpose |
|---|---|
| `diseases` | Master list of 45 Egypt DES notifiable diseases + ICD-10 codes + Group A/B |
| `case_reports` | One row per submitted case report (online or SMS-decoded) |
| `alerts` | Anomaly-triggered or Group A alerts; tracks dispatch status |
| `audit_log` | Immutable append-only log of every state change |
| `drift_metrics` | Weekly drift audit results |
| `baseline_cache` | Pre-computed seasonal baseline statistics per (governorate, icd10_prefix, epi_week) |

---

## 2. `diseases`

Seeded from `db/seeds/egypt_des_diseases.sql` (45 rows: 32 Group A, 13 Group B).

```sql
CREATE TABLE diseases (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    icd10_code  VARCHAR(10) UNIQUE NOT NULL,  -- e.g. "A00", "B26_MU"
    name        VARCHAR(200) NOT NULL,         -- e.g. "Cholera"
    group_label CHAR(1) NOT NULL CHECK (group_label IN ('A', 'B')),
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diseases_icd10 ON diseases(icd10_code);
```

**Notes:**
- `icd10_code` is the lookup key for all classification logic
- `B26_MU` = Mumps (Group A); `B26` = Viral Hepatitis (Group B) — suffix prevents collision
- All 45 codes are loaded at container startup via `docker-entrypoint-initdb.d/01_seed.sql`

---

## 3. `case_reports`

Core reporting table. One row per case, regardless of submission channel.

```sql
CREATE TABLE case_reports (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Submission metadata
    submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    epi_week         SMALLINT NOT NULL,           -- computed at insert: submitted_at.isocalendar()[1]
    submission_mode  VARCHAR(20) NOT NULL DEFAULT 'online'
                     CHECK (submission_mode IN ('online', 'offline-cached', 'sms-fallback')),
    sync_status      VARCHAR(20) NOT NULL DEFAULT 'synced'
                     CHECK (sync_status IN ('synced', 'pending', 'failed')),

    -- Location
    facility_id      VARCHAR(50) NOT NULL,         -- e.g. "EGY-PHC-0042"
    governorate      VARCHAR(100) NOT NULL,
    district         VARCHAR(100),

    -- Physician (anonymised)
    physician_id     VARCHAR(64) NOT NULL,         -- SHA-256 hash of raw ID (never raw)

    -- Disease
    icd10_code       VARCHAR(10) NOT NULL REFERENCES diseases(icd10_code),
    reporting_group  CHAR(1) NOT NULL CHECK (reporting_group IN ('A', 'B')),
    symptom_onset_date DATE,
    diagnosis_basis  VARCHAR(30)
                     CHECK (diagnosis_basis IN ('Clinical', 'Lab-confirmed', 'Epidemiological link')),

    -- Patient (anonymous — no identifiers)
    age_group        VARCHAR(10) NOT NULL
                     CHECK (age_group IN ('<1', '1-4', '5-14', '15-29', '30-59', '60+')),
    sex              VARCHAR(10) NOT NULL
                     CHECK (sex IN ('Male', 'Female')),
    nationality      VARCHAR(20)
                     CHECK (nationality IN ('Egyptian', 'Other')),
    hospitalized     BOOLEAN NOT NULL DEFAULT FALSE,
    outcome          VARCHAR(20) NOT NULL DEFAULT 'Unknown'
                     CHECK (outcome IN ('Alive', 'Dead', 'Unknown')),
    lab_sample_taken BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_reports_icd10      ON case_reports(icd10_code);
CREATE INDEX idx_reports_governorate ON case_reports(governorate);
CREATE INDEX idx_reports_submitted  ON case_reports(submitted_at);
CREATE INDEX idx_reports_epi_week   ON case_reports(epi_week);
CREATE INDEX idx_reports_group      ON case_reports(reporting_group);
-- Composite for anomaly queries
CREATE INDEX idx_reports_geo_disease ON case_reports(governorate, icd10_code, submitted_at);
```

**What is never stored:**
- Patient name
- Patient date of birth (age_group bracket only)
- Patient address
- Raw physician ID (hashed before write)
- Facility street address

---

## 4. `alerts`

Created when anomaly detection fires (HIGH or REVIEW) or on any Group A report.

```sql
CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_report_id  UUID NOT NULL REFERENCES case_reports(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Detection result
    alert_level     VARCHAR(20) NOT NULL CHECK (alert_level IN ('HIGH', 'REVIEW', 'NORMAL')),
    z_score         FLOAT,
    confidence      FLOAT,                     -- 0.0–1.0; NULL if Group A auto-trigger

    -- Dispatch
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'dispatched', 'under_review', 'confirmed', 'dismissed')),
    dispatched_at   TIMESTAMPTZ,
    dispatch_targets JSONB,                    -- e.g. {"ministry": true, "who_fhir": true, "sms": false}

    -- Epidemiologist review (for REVIEW-level alerts)
    reviewed_by     VARCHAR(100),              -- epidemiologist identifier
    reviewed_at     TIMESTAMPTZ,
    review_decision VARCHAR(20)
                    CHECK (review_decision IN ('confirmed', 'dismissed', NULL)),
    review_notes    TEXT
);

CREATE INDEX idx_alerts_case_report ON alerts(case_report_id);
CREATE INDEX idx_alerts_status      ON alerts(status);
CREATE INDEX idx_alerts_created     ON alerts(created_at);
```

---

## 5. `audit_log`

Append-only. Never updated or deleted. Records every significant system event.

```sql
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type  VARCHAR(50) NOT NULL,    -- e.g. "report_submitted", "alert_dispatched", "drift_detected"
    entity_type VARCHAR(50),             -- e.g. "case_report", "alert"
    entity_id   UUID,
    payload     JSONB,                   -- event-specific data (anonymised)
    source      VARCHAR(30)              -- "api", "sms_webhook", "scheduler"
);

CREATE INDEX idx_audit_occurred  ON audit_log(occurred_at);
CREATE INDEX idx_audit_event     ON audit_log(event_type);
CREATE INDEX idx_audit_entity_id ON audit_log(entity_id);
```

---

## 6. `drift_metrics`

One row per weekly audit run.

```sql
CREATE TABLE drift_metrics (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_run_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    week_start               DATE NOT NULL,
    week_end                 DATE NOT NULL,

    total_reports            INTEGER NOT NULL,
    total_alerts             INTEGER NOT NULL,
    alert_rate               FLOAT NOT NULL,
    alert_rate_status        VARCHAR(20) NOT NULL CHECK (alert_rate_status IN ('NORMAL', 'DRIFT_DETECTED')),

    mean_confidence          FLOAT,
    human_confirmation_rate  FLOAT,           -- NULL if no REVIEW alerts that week

    baseline_recalibrated    BOOLEAN NOT NULL DEFAULT FALSE,
    notes                    TEXT
);
```

---

## 7. `baseline_cache`

Pre-computed seasonal statistics per (governorate, icd10_prefix, epi_week_number). Refreshed quarterly.

```sql
CREATE TABLE baseline_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    governorate     VARCHAR(100) NOT NULL,
    icd10_prefix    VARCHAR(3) NOT NULL,       -- first 3 chars of ICD-10 code
    epi_week        SMALLINT NOT NULL,          -- 1–53
    baseline_mean   FLOAT NOT NULL,
    baseline_std    FLOAT NOT NULL,
    data_points     INTEGER NOT NULL,           -- number of historical weeks used
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (governorate, icd10_prefix, epi_week)
);
```

---

## 8. PostGIS

PostGIS extension is enabled but facility coordinates are optional in the hackathon build. The column is reserved for geo-cluster visualisation on the dashboard map.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- Optional: add to case_reports if coordinates available
ALTER TABLE case_reports ADD COLUMN IF NOT EXISTS
    facility_location GEOMETRY(Point, 4326);

CREATE INDEX IF NOT EXISTS idx_reports_location
    ON case_reports USING GIST(facility_location);
```

---

## 9. Alembic

Migration file: `alembic/versions/001_initial_schema.py`

All tables created in dependency order:
1. `diseases` (no FK dependencies)
2. `case_reports` (FK → diseases.icd10_code)
3. `alerts` (FK → case_reports.id)
4. `audit_log`, `drift_metrics`, `baseline_cache` (independent)

**UUID columns** use SQLAlchemy 2.0 `Uuid` type — not `postgresql.UUID` — for SQLite compatibility in tests.

---

## 10. Seed Data

File: `db/seeds/egypt_des_diseases.sql`
Mounted as: `docker-entrypoint-initdb.d/01_seed.sql`

45 diseases total:
- 32 Group A (immediate alert): Cholera, Rabies, Ebola, Mpox, Meningococcal meningitis, Plague, MERS-CoV, Polio, Diphtheria, Mumps, and others
- 13 Group B (weekly aggregate): Typhoid, Hepatitis A, Measles, Brucellosis, Leishmaniasis, and others

Key ICD-10 codes referenced throughout the codebase:

| Disease | ICD-10 | Group |
|---|---|---|
| Cholera | A00 | A |
| Typhoid fever | A01.0 | B |
| Meningococcal meningitis | A39.0 | A |
| Rabies | A82 | A |
| Dengue fever | A90 | A |
| Ebola | A98.4 | A |
| Measles | B05 | B |
| Mpox | B04 | A |
| Hepatitis A | B15 | B |
| Mumps | B26_MU | A |
| Viral Hepatitis (other) | B26 | B |
