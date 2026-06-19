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
- [Quick Start](#quick-start)
- [Full Stack (Docker)](#full-stack-docker)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Data Input Pipeline](#data-input-pipeline)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Features

| Feature | Description |
|---------|-------------|
| **Structured Case Reports** | Selection-based form eliminates free-text errors |
| **Multi-Modal Input** | Form, free-text, SMS, and image/OCR submission |
| **Offline-First** | IndexedDB cache + SMS fallback for low-connectivity areas |
| **Real-Time Alerts** | Group A diseases trigger alerts within 60 seconds |
| **Anomaly Detection** | Z-score analysis against 52-week seasonal baselines |
| **Drift Monitoring** | Weekly audits with automatic baseline recalibration |
| **Light/Dark Mode** | Persistent theme with system preference detection |
| **Privacy by Design** | Patient identifiers never leave country-level servers |

---

## Architecture

```
Frontend (React + TanStack)
    |  Structured Form / Free Text / Image Upload
    |  Theme Toggle (Light/Dark)
    |
    v
FastAPI Backend
    |-- /api/input/form      Structured form submission
    |-- /api/input/text      Free-text / SMS parsing
    |-- /api/input/image     Image OCR + text extraction
    |-- /api/input/ocr-text  Frontend-extracted OCR text
    |-- /api/v1/report       Direct case report
    |-- /api/v1/alerts       Alert listing & review
    |-- /api/v1/dashboard    Dashboard statistics
    |-- /api/v1/sms-webhook  Twilio SMS fallback
    |-- /health              Health check
    |
    v
PostgreSQL + PostGIS
    |-- diseases (45 DES diseases)
    |-- case_reports
    |-- alerts
    |-- drift_metrics
    |-- baseline_cache
    |-- audit_log
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+ (for frontend)
- PostgreSQL (or use Docker)

### 1. Backend

```bash
cd epilink
pip install -r requirements.txt

# Copy and edit environment
cp .env.example .env

# Run tests (27 tests, no PostgreSQL needed)
pytest tests/ -v

# Start dev server
uvicorn main:app --reload
# Server runs on http://localhost:8000
```

### 2. Frontend

```bash
cd frontend
npm install    # or bun install

# Create .env
echo "VITE_API_BASE_URL=http://localhost:8000" > .env

# Start dev server
npm run dev
# Frontend runs on http://localhost:5173
```

### 3. Verify

```bash
curl http://localhost:8000/health
# {"status":"ok","version":"1.0.0","database":"connected",...}
```

---

## Full Stack (Docker)

```bash
cd epilink
docker compose up --build
# PostgreSQL + PostGIS on port 5432
# FastAPI on port 8000
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql+asyncpg://epilink:password@localhost:5432/epilink_db` |
| `ENVIRONMENT` | `development` or `production` | `development` |
| `OPENAI_API_KEY` | OpenAI key for AI parsing (optional) | - |
| `MINISTRY_WEBHOOK_URL` | Ministry alert endpoint | - |
| `WHO_FHIR_URL` | WHO HL7 FHIR endpoint | - |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | - |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | - |

---

## API Endpoints

### Core Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/report` | Submit structured case report |
| `POST` | `/api/v1/sms-webhook` | Twilio SMS fallback |
| `GET` | `/api/v1/alerts` | List alerts (filterable) |
| `PATCH` | `/api/v1/alerts/{id}/review` | Review alert decision |
| `GET` | `/api/v1/dashboard` | Weekly stats + alerts |
| `GET` | `/api/v1/reference/diseases` | List 45 DES diseases |

### Data Input Endpoints (New)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/input/text` | Free-text / SMS input |
| `POST` | `/api/input/form` | Structured form input |
| `POST` | `/api/input/image` | Image OCR + processing |
| `POST` | `/api/input/ocr-text` | Frontend-extracted OCR text |
| `GET` | `/api/input/health` | Input service health |

---

## Data Input Pipeline

### 1. Text Input (`POST /api/input/text`)

Accepts raw clinical text, translates if needed, extracts structured data.

```json
{
  "text": "Patient with fever and cholera symptoms in Cairo, age 30-59, male",
  "source": "manual"
}
```

**Response:**
```json
{
  "success": true,
  "structured_data": {
    "icd10_code": "A00.1",
    "governorate": "Cairo",
    "age_group": "30-59",
    "sex": "Male",
    "submission_mode": "text-extracted"
  },
  "report_id": "uuid",
  "reporting_group": "A",
  "alert_triggered": true,
  "confidence_score": 0.7,
  "warnings": [],
  "requires_human_review": false
}
```

### 2. Form Input (`POST /api/input/form`)

Validated structured form submission.

```json
{
  "facility_id": "EGY-PHC-001",
  "physician_id": "dr-smith",
  "governorate": "Cairo",
  "district": "Heliopolis",
  "icd10_code": "A39.0",
  "symptom_onset_date": "2026-06-15",
  "diagnosis_basis": "Lab-confirmed",
  "age_group": "15-29",
  "sex": "Male",
  "hospitalized": true,
  "outcome": "Alive",
  "lab_sample_taken": true
}
```

### 3. Image Input (`POST /api/input/image`)

Uploads image for OCR extraction and AI parsing.

```json
{
  "image_base64": "<base64-encoded-image>",
  "image_format": "jpeg",
  "facility_id": "EGY-PHC-001"
}
```

### 4. OCR Text Input (`POST /api/input/ocr-text`)

Accepts pre-extracted OCR text from frontend.

```json
{
  "text": "Meningitis case, 15-29 age group, male, Aswan governorate",
  "source_language": "en"
}
```

---

## Responsible AI Safeguards

- **Confidence Scoring**: Every extraction returns a confidence score (0.0 - 1.0)
- **Human Review Flag**: Low-confidence results flagged for manual review
- **Warnings**: Missing or uncertain data fields generate explicit warnings
- **Fallback Parser**: Rule-based extraction when AI services unavailable
- **No Medical Claims**: System extracts data only, does not diagnose
- **Transparent**: All extraction decisions logged and auditable

---

## Testing

```bash
cd epilink

# Run all 27 tests
pytest tests/ -v

# Tests cover:
# - Classifier service (9 tests)
# - SMS parser (8 tests)
# - Report submission (4 tests)
# - Demo scenarios (4 tests)
```

---

## Deployment

### Railway (Recommended)

1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push

### Docker

```bash
docker build -t epilink-api .
docker run -p 8000:8000 --env-file .env epilink-api
```

---

## Project Structure

```
epilink/
  main.py                  # FastAPI app + lifespan + scheduler
  core/
    config.py              # Settings
    database.py            # Async SQLAlchemy
    security.py            # Physician ID hashing
  models/                  # SQLAlchemy ORM models
  schemas/
    report.py              # Report schemas
    alert.py               # Alert + Dashboard schemas
    input.py               # Input pipeline schemas
  services/
    classifier.py          # ICD-10 classification (deterministic)
    anomaly.py             # Z-score anomaly detection
    drift_monitor.py       # Weekly drift monitoring
    sms_parser.py          # Fixed-position SMS parser
    alert_dispatcher.py    # Alert dispatch (webhooks)
    ocr.py                 # Image OCR extraction
    translation.py         # Multi-language translation
    ai_parser.py           # AI text-to-JSON parsing
  routers/
    health.py              # GET /health
    report.py              # POST /api/v1/report
    alert.py               # GET/PATCH /api/v1/alerts
    dashboard.py           # GET /api/v1/dashboard
    sms.py                 # POST /api/v1/sms-webhook
    input.py               # POST /api/input/*
    reference.py           # GET /api/v1/reference/diseases
  tests/                   # 27 tests (SQLite, no PG needed)

frontend/
  src/
    lib/api/
      config.ts            # API endpoints registry
      client.ts            # Fetch wrapper
      services.ts          # API service functions
      types.ts             # TypeScript types
    hooks/
      use-theme.tsx         # Theme provider (light/dark)
      use-online.tsx        # Online status hook
    components/
      layout/AppShell.tsx   # Main layout with sidebar
      providers/            # Theme provider
    routes/
      index.tsx             # Global map page
      submit.tsx            # Report submission (form/text/image)
      alerts.tsx            # Alert listing
      review.tsx            # Alert review
      dashboard.tsx         # Dashboard statistics
      health.tsx            # Health status
```
