# EpiLink

Egypt Disease Surveillance System — FastAPI backend for real-time disease reporting, alert dispatch, anomaly detection, and drift monitoring.

## Quick start

```bash
cd epilink
pip install -r requirements.txt
pytest tests/ -v            # 27 tests
uvicorn main:app --reload   # dev server on :8000
```

## Full stack (PostGIS + API)

```bash
docker compose up --build
```

## Architecture

```
epilink/
├── main.py                     # FastAPI app + lifespan + scheduler
├── core/{config,database,security}.py
├── models/                     # SQLAlchemy 2.0 async ORM (4 tables)
├── schemas/                    # Pydantic v2 request/response
├── services/                   # classifier, anomaly, drift, SMS, alerts
├── routers/                    # health, report, alert, dashboard, sms
├── db/seeds/                   # 45-disease seed (docker-entrypoint-initdb.d)
├── alembic/                    # async migration
└── tests/                      # 27 tests (SQLite, no PG required)
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| POST | `/api/v1/report` | Submit case report |
| POST | `/api/v1/sms-webhook` | Twilio SMS fallback |
| GET | `/api/v1/alerts` | List alerts (filterable) |
| PATCH | `/api/v1/alerts/{id}/review` | Review decision |
| GET | `/api/v1/dashboard` | Weekly stats + recent alerts |
