# EpiLink

**Egypt Disease Surveillance System**

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688.svg)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Real-time disease reporting, alert dispatch, anomaly detection, and drift monitoring for Egypt's public health infrastructure.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Full Stack (Docker)](#full-stack-docker)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [SMS Format](#sms-format)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| Feature | Description |
|---------|-------------|
| **Structured Case Reports** | Selection-based form eliminates free-text errors — no NLP needed |
| **Offline-First** | IndexedDB cache + SMS fallback for low-connectivity areas |
| **Real-Time Alerts** | Group A diseases trigger alerts within 60 seconds |
| **Anomaly Detection** | Z-score analysis against 52-week seasonal baselines |
| **Drift Monitoring** | Weekly audits with automatic baseline recalibration |
| **Privacy by Design** | Patient identifiers never leave country-level servers |
| **Multi-Channel Dispatch** | Ministry webhook, WHO HL7 FHIR, SMS notifications |

---

## Architecture

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

## Tech Stack

| Layer | Technology |
|-------|------------|
| **API Framework** | FastAPI (Python 3.11) |
| **ORM** | SQLAlchemy 2.0 (async) |
| **Database** | PostgreSQL 15 + PostGIS 3 |
| **DB Driver (prod)** | asyncpg |
| **DB Driver (test)** | aiosqlite |
| **Migrations** | Alembic |
| **SMS Gateway** | Twilio |
| **Scheduler** | APScheduler |
| **Containerization** | Docker + Docker Compose |
| **Testing** | pytest + pytest-asyncio + pytest-httpx |
| **HTTP Client** | httpx (async) |

---

## Quick Start

### Prerequisites

- Python 3.11+
- pip
- PostgreSQL (or use Docker for full stack)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/epilink.git
cd epilink/epilink
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Run Tests

```bash
pytest tests/ -v
# Expected: 27 tests passing
```

### 4. Start Development Server

```bash
uvicorn main:app --reload
# Server starts on http://localhost:8000
```

### 5. Verify

```bash
curl http://localhost:8000/health
```

---

## Full Stack (Docker)

Run the complete system with PostgreSQL + PostGIS:

```bash
cd epilink
docker compose up --build
```

This starts:
- **PostgreSQL + PostGIS** on port `5432`
- **FastAPI** on port `8000`

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://epilink:password@localhost:5432/epilink_db` |
| `ENVIRONMENT` | `development` or `production` | `development` |
| `MINISTRY_WEBHOOK_URL` | Ministry alert endpoint | - |
| `WHO_FHIR_URL` | WHO HL7 FHIR endpoint | - |
| `ADMIN_WEBHOOK_URL` | Admin drift notifications | - |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | - |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | - |
| `TWILIO_FROM_NUMBER` | Twilio sender number | - |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/report` | Submit case report |
| `POST` | `/api/v1/sms-webhook` | Twilio SMS fallback |
| `GET` | `/api/v1/alerts` | List alerts (filterable) |
| `PATCH` | `/api/v1/alerts/{id}/review` | Review alert decision |
| `GET` | `/api/v1/dashboard` | Weekly stats + alerts |

### Submit Case Report

```bash
curl -X POST http://localhost:8000/api/v1/report \
  -H "Content-Type: application/json" \
  -d '{
    "facility_id": "EGY-PHC-0042",
    "physician_id": "dr-smith-001",
    "governorate": "Cairo",
    "district": "Heliopolis",
    "icd10_code": "A39.0",
    "symptom_onset_date": "2026-06-13",
    "diagnosis_basis": "Lab-confirmed",
    "age_group": "15-29",
    "sex": "Male",
    "nationality": "Egyptian",
    "hospitalized": true,
    "outcome": "Alive",
    "lab_sample_taken": true,
    "submission_mode": "online"
  }'
```

### Get Alerts

```bash
# All alerts
curl http://localhost:8000/api/v1/alerts

# Filtered by governorate
curl "http://localhost:8000/api/v1/alerts?governorate=Cairo&status=pending"
```

### Dashboard

```bash
# Last 4 weeks
curl http://localhost:8000/api/v1/dashboard

# Last 12 weeks for Cairo
curl "http://localhost:8000/api/v1/dashboard?weeks=12&governorate=Cairo"
```

---

## SMS Format

Physicians can submit reports via SMS when offline:

```
RPT#FACILITYID#ICD10CODE#AGEGROUP#SEX#OUTCOME
```

### Example

```
RPT#EGY042#A39.0#15-29#M#ALIVE
```

### Field Reference

| Position | Field | Values |
|----------|-------|--------|
| 0 | Command | `RPT` |
| 1 | Facility ID | e.g., `EGY042` |
| 2 | ICD-10 Code | e.g., `A39.0` |
| 3 | Age Group | `<1`, `1-4`, `5-14`, `15-29`, `30-59`, `60+` |
| 4 | Sex | `M` / `F` |
| 5 | Outcome | `ALIVE` / `DEAD` / `UNKNOWN` |

---

## Testing

### Run All Tests

```bash
cd epilink
pytest tests/ -v
```

### Run Specific Test

```bash
pytest tests/test_report.py -v
```

### Test Coverage

- **27 tests** covering all endpoints
- SQLite in-memory database (no PostgreSQL required)
- Mocked external services (Twilio, webhooks)

---

## Project Structure

```
epilink/
├── main.py                     # FastAPI app + lifespan + scheduler
├── core/
│   ├── config.py               # Settings & environment variables
│   ├── database.py             # Async SQLAlchemy engine & sessions
│   └── security.py             # Physician ID hashing (SHA-256)
├── models/                     # SQLAlchemy 2.0 async ORM (4 tables)
│   ├── disease.py
│   ├── case_report.py
│   ├── alert.py
│   └── audit_log.py
├── schemas/                    # Pydantic v2 request/response
│   ├── report.py
│   ├── alert.py
│   └── dashboard.py
├── services/
│   ├── classifier.py           # ICD-10 classification (deterministic)
│   ├── anomaly.py              # Z-score anomaly detection
│   ├── drift.py                # Weekly drift monitoring
│   ├── sms_parser.py           # Fixed-position SMS parser
│   └── alerts.py               # Alert dispatcher
├── routers/
│   ├── health.py
│   ├── report.py
│   ├── alert.py
│   ├── dashboard.py
│   └── sms_webhook.py
├── db/seeds/                   # 45-disease seed data
├── alembic/                    # Async migrations
├── tests/                      # 27 tests
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

---

## Deployment

### Railway (Recommended)

1. Connect your GitHub repository
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Docker

```bash
# Build image
docker build -t epilink-api .

# Run container
docker run -p 8000:8000 --env-file .env epilink-api
```

### Manual

```bash
# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start server
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- **USAII Hackathon 2026** - Graduate Track
- **Team**: Sarah Abossoud, Hasan Ali, Egharevba Nosakhare
