# EpiLink

## Commands

```powershell
pip install -r requirements.txt
pytest tests/ -v                              # all tests (27 total)
pytest tests/test_demo_scenarios.py -v        # 4 demo scenarios
docker compose up --build                     # full stack (PostGIS + API)
```

## Project map

```
epilink/
├── main.py                     # FastAPI app entrypoint
├── core/{config,database,security}.py
├── models/                     # SQLAlchemy 2.0 async ORM
├── schemas/                    # Pydantic v2 request/response
├── services/                   # Business logic (classifier, anomaly, drift, SMS, alerts)
├── routers/                    # FastAPI route handlers
├── db/seeds/egypt_des_diseases.sql   # docker-entrypoint-initdb.d seed
├── alembic/versions/001_initial_schema.py
└── tests/
    ├── conftest.py             # SQLite file-based test DB, auto-override async_session_factory
    ├── test_classifier.py
    ├── test_sms_parser.py
    ├── test_report.py
    └── test_demo_scenarios.py  # 4 end-to-end scenarios
```

## Architecture notes

- **All DB queries are async** (SQLAlchemy 2.0 async style + asyncpg/aiosqlite).
- **Group A alerts fire-and-forget** via `asyncio.create_task` — never `await` inside request handler.
- **S3M: `B26_MU`** = Mumps (Group A), **`B26`** = Viral Hepatitis (Group B). The `_MU` suffix avoids collision.
- **Epi week** = ISO 8601 from `submitted_at.isocalendar()[1]`, computed at insert.
- **physician_id** is always SHA-256 hashed before DB write (`core/security.py`). Never stored raw.
- SMS webhook validates Twilio signature in production (`ENVIRONMENT != "development"`), skips in dev.
- All error responses use `{"error": "...", "code": "..."}` format.

## Testing quirks

- **`conftest.py` patches `core_database.async_session_factory` BEFORE importing `main`**, then overrides `get_db`. This is required because background tasks (via `create_task`) reference `core_db.async_session_factory` at runtime via module attribute lookup (`core_db.async_session_factory()`) — not via a local import.
- **File-based SQLite** (`sqlite+aiosqlite:///{tempfile}`), not `:memory:`. In-memory SQLite is per-connection, so tables created in one connection are invisible to another.
- **UUID columns** use SQLAlchemy 2.0's `Uuid` type (not `postgresql.UUID`) so they work with both PostgreSQL and SQLite.
- **Anomaly detector** avoids `date_trunc` (PostgreSQL-only). Uses Python week-boundary iteration with simple `>= / <` range queries.
- `AlertOut.case_report_id` is typed as `uuid.UUID` (Pydantic v2 auto-serializes to string).
- `httpx_mock` fixture from `pytest-httpx` intercepts ALL outbound HTTP (Ministry/WHO/admin webhooks). Register responses before the test makes requests.

## Seed data

45 diseases in `db/seeds/egypt_des_diseases.sql`: 32 Group A (immediate), 13 Group B (weekly). Mounted as `docker-entrypoint-initdb.d/01_seed.sql` in compose.

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| POST | `/api/v1/report` | Submit case report |
| POST | `/api/v1/sms-webhook` | Twilio SMS fallback |
| GET | `/api/v1/alerts` | List alerts (filter: governorate, status, icd10_code) |
| PATCH | `/api/v1/alerts/{id}/review` | Review decision |
| GET | `/api/v1/dashboard` | Weekly stats + recent alerts |
