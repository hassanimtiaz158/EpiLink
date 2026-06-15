# DEPLOYMENT — EpiLink
**Hackathon demo deployment | Target: Railway (FastAPI) + Railway PostgreSQL**

---

## 1. Local Development (Docker)

The fastest way to run the full stack locally.

```powershell
# Build and start all services (PostGIS + API)
docker compose up --build

# API available at: http://localhost:8000
# Health check:    http://localhost:8000/health
# Docs (Swagger):  http://localhost:8000/docs
```

**First run:** Docker Compose starts PostgreSQL, waits for it to be healthy, then mounts `db/seeds/egypt_des_diseases.sql` as `docker-entrypoint-initdb.d/01_seed.sql`. The seed runs automatically and populates 45 diseases.

**Stopping:**
```powershell
docker compose down          # stop containers
docker compose down -v       # stop + delete DB volume (full reset)
```

---

## 2. `docker-compose.yml`

```yaml
version: "3.9"

services:
  db:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: epilink
      POSTGRES_USER: epilink
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-epilink_dev}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/seeds/egypt_des_diseases.sql:/docker-entrypoint-initdb.d/01_seed.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U epilink -d epilink"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://epilink:${POSTGRES_PASSWORD:-epilink_dev}@db:5432/epilink
      ENVIRONMENT: development
      TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID:-}
      TWILIO_AUTH_TOKEN: ${TWILIO_AUTH_TOKEN:-}
      TWILIO_PHONE_NUMBER: ${TWILIO_PHONE_NUMBER:-}
      MINISTRY_WEBHOOK_URL: ${MINISTRY_WEBHOOK_URL:-http://localhost:9000/mock/ministry}
      WHO_FHIR_URL: ${WHO_FHIR_URL:-http://localhost:9000/mock/who}
      ADMIN_WEBHOOK_URL: ${ADMIN_WEBHOOK_URL:-http://localhost:9000/mock/admin}
    depends_on:
      db:
        condition: service_healthy
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

volumes:
  pgdata:
```

---

## 3. Environment Variables

Create `.env` in project root (not committed to git):

```env
# Database
POSTGRES_PASSWORD=your_secure_password

# App
ENVIRONMENT=development   # or "production"

# Twilio (SMS fallback)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Webhook targets
MINISTRY_WEBHOOK_URL=https://your-ministry-mock.example.com/webhook
WHO_FHIR_URL=https://your-who-mock.example.com/fhir
ADMIN_WEBHOOK_URL=https://your-admin-notify.example.com/webhook
```

**`ENVIRONMENT=development`** disables Twilio signature validation on `/api/v1/sms-webhook`. Set to `production` on Railway to enforce it.

---

## 4. Running Tests

No Docker needed — tests use SQLite.

```powershell
# Install dependencies
pip install -r requirements.txt

# Run all 27 tests
pytest tests/ -v

# Run demo scenarios only
pytest tests/test_demo_scenarios.py -v

# With coverage report
pytest tests/ -v --cov=. --cov-report=term-missing
```

---

## 5. Database Migrations

```powershell
# Inside docker or with DATABASE_URL set:

# Run migrations
alembic upgrade head

# Create new migration (after model changes)
alembic revision --autogenerate -m "description"

# Check current revision
alembic current
```

Migrations run automatically on container startup if you add to `main.py` lifespan:
```python
from alembic.config import Config
from alembic import command

@asynccontextmanager
async def lifespan(app: FastAPI):
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    yield
```

---

## 6. Railway Deployment (Production)

Railway is the recommended free-tier host for FastAPI + PostgreSQL.

### Steps

**1. Create Railway project**
- Go to railway.app → New Project
- Add service: PostgreSQL (Railway managed — includes PostGIS on request)
- Add service: Deploy from GitHub repo

**2. Set environment variables in Railway dashboard**
```
DATABASE_URL          → (auto-set by Railway PostgreSQL plugin as ${{Postgres.DATABASE_URL}})
ENVIRONMENT           → production
TWILIO_ACCOUNT_SID    → your value
TWILIO_AUTH_TOKEN     → your value
TWILIO_PHONE_NUMBER   → your value
MINISTRY_WEBHOOK_URL  → your mock endpoint
WHO_FHIR_URL          → your mock endpoint
ADMIN_WEBHOOK_URL     → your mock endpoint
```

**3. `Procfile` (Railway uses this)**
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

Or use `railway.toml`:
```toml
[build]
builder = "DOCKERFILE"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 30
```

**4. Twilio webhook URL**
After Railway deployment, set your Twilio phone number's incoming SMS webhook to:
```
https://your-app.railway.app/api/v1/sms-webhook
```

**5. Seed data**
Railway PostgreSQL runs the seed automatically if you copy the Alembic + seed approach into the startup command:
```
alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT
```

---

## 7. Demo Preparation

Before recording the demo video or presenting to judges:

```powershell
# 1. Full reset
docker compose down -v

# 2. Fresh build
docker compose up --build

# 3. Verify health
curl http://localhost:8000/health

# 4. Verify seed data (45 diseases)
curl http://localhost:8000/api/v1/dashboard

# 5. Run all tests pass
pytest tests/ -v
```

### Demo Scenario Commands

**Scenario 1 — Group A alert (Cholera):**
```powershell
curl -X POST http://localhost:8000/api/v1/report \
  -H "Content-Type: application/json" \
  -d '{
    "facility_id": "EGY-PHC-0042",
    "physician_id": "demo-physician-01",
    "governorate": "Cairo",
    "district": "Heliopolis",
    "icd10_code": "A00",
    "symptom_onset_date": "2026-06-15",
    "diagnosis_basis": "Lab-confirmed",
    "age_group": "30-59",
    "sex": "Male",
    "nationality": "Egyptian",
    "hospitalized": true,
    "outcome": "Alive",
    "lab_sample_taken": true,
    "submission_mode": "online"
  }'

# Then check alert was dispatched:
curl http://localhost:8000/api/v1/alerts?icd10_code=A00
```

**Scenario 2 — SMS fallback:**
```powershell
curl -X POST http://localhost:8000/api/v1/sms-webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "Body=RPT%23EGY042%23A00%2330-59%23M%23ALIVE&From=%2B201012345678"
```

**Scenario 3 — Dashboard:**
```powershell
curl http://localhost:8000/api/v1/dashboard
```

---

## 8. `Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 9. Submission Checklist

- [ ] `docker compose up --build` runs cleanly from a fresh clone
- [ ] All 27 tests pass: `pytest tests/ -v`
- [ ] `/health` returns 200 on Railway deployment
- [ ] Twilio webhook configured with Railway URL
- [ ] Demo video recorded (Scenario 1 + 2 minimum, 3 minutes max)
- [ ] Devpost submission includes: GitHub link, demo video, team members, judge weakness responses
- [ ] README includes setup instructions and the three judge-facing weakness answers
