# EpiLink Frontend-Backend Integration — Hackathon Setup

## ✅ Completed Tasks

### 1. Environment & CORS Configuration
- ✅ Created frontend `.env` file with `VITE_API_BASE_URL=http://localhost:8000`
- ✅ Backend CORS middleware already configured (allows all origins in development)

### 2. Backend Endpoints
- ✅ Added `/api/reference/diseases` — returns list of diseases for form selectors
- ✅ `/api/v1/report` (POST) — submit case reports ✓
- ✅ `/api/v1/alerts` (GET) — list alerts ✓
- ✅ `/api/v1/alerts/{id}/review` (PATCH) — review alerts ✓
- ✅ `/api/v1/dashboard` (GET) — dashboard data with trends, top diseases, recent alerts ✓
- ✅ `/health` (GET) — health check ✓

### 3. Frontend Integration
- ✅ Updated Dashboard page to display backend data (reports, alerts, trends, top diseases)
- ✅ Updated Alerts page to work with backend Alert schema (icd10_code, governorate, etc.)
- ✅ Submit form already integrated with report submission
- ✅ API types and schemas aligned with backend

### 4. Database Setup
- ✅ Enabled disease seed data in docker-compose.yml
- ✅ Migrations create all necessary tables
- ✅ 45 diseases (Group A & B) will be seeded automatically

---

## 🚀 Quick Start — Running the Full Stack

### Backend (Python FastAPI)
```bash
cd epilink
# Start PostgreSQL + API with Docker
docker compose up --build

# API will be available at: http://localhost:8000
# Health check: http://localhost:8000/health
# API docs: http://localhost:8000/docs (Swagger UI)
```

### Frontend (React + Vite)
```bash
cd ../frontend

# Install dependencies
bun install
# or npm install

# Start dev server
bun dev
# or npm run dev

# Frontend will be at: http://localhost:5173
```

---

## 📋 Testing Checklist

- [ ] **Backend Health**: `curl http://localhost:8000/health`
- [ ] **Disease List**: `curl http://localhost:8000/api/reference/diseases`
- [ ] **Frontend Loads**: http://localhost:5173
- [ ] **Form Submission**: Visit `/submit`, fill form, click submit
- [ ] **Dashboard**: Visit `/dashboard` → should see reports/alerts stats
- [ ] **Alerts**: Visit `/alerts` → should display recent alerts from backend

---

## 🔗 Key Endpoints & Integration Points

| Feature | Frontend | Backend | Status |
|---------|----------|---------|--------|
| Submit Report | `/submit` form | `POST /api/v1/report` | ✅ Ready |
| View Alerts | `/alerts` page | `GET /api/v1/alerts` | ✅ Ready |
| Review Alert | `/review` page | `PATCH /api/v1/alerts/{id}/review` | ✅ Ready |
| Dashboard | `/dashboard` page | `GET /api/v1/dashboard` | ✅ Ready |
| Disease Lookup | Form dropdown | `GET /api/reference/diseases` | ✅ Ready |
| Health Check | N/A | `GET /health` | ✅ Ready |

---

## ⚙️ Environment Files

### Backend: `epilink/.env`
```
DATABASE_URL=postgresql+asyncpg://epilink:password@db:5432/epilink_db
MINISTRY_WEBHOOK_URL=https://mock-ministry.epilink.io/webhook
WHO_WEBHOOK_URL=https://mock-who.epilink.io/webhook
ADMIN_WEBHOOK_URL=https://mock-admin.epilink.io/webhook
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
SECRET_KEY=change-me-in-production
ENVIRONMENT=development
```

### Frontend: `frontend/.env`
```
VITE_API_BASE_URL=http://localhost:8000
```

---

## 📝 Data Flow

1. **User submits report** → Frontend form → `/api/v1/report` POST
2. **Backend processes** → Classifies disease → Triggers anomaly detection
3. **Alerts generated** → Stored in PostgreSQL → Available at `/api/v1/alerts`
4. **Dashboard aggregates** → Weekly trends, top diseases, pending reviews
5. **User reviews alert** → PATCH `/api/v1/alerts/{id}/review` with decision

---

## 🎯 MVP Feature Set (Hackathon-Ready)

- ✅ Disease selection from 45 Egyptian DES diseases
- ✅ Online/offline-capable form submission
- ✅ Real-time dashboard with key metrics
- ✅ Alert filtering & status management
- ✅ Z-score anomaly detection
- ✅ Weekly trend visualization
- ✅ PostgreSQL + PostGIS backend persistence
- ✅ CORS-enabled API for frontend integration

---

## 🐛 Troubleshooting

**Frontend can't reach backend?**
- Check `VITE_API_BASE_URL` in `frontend/.env`
- Ensure backend is running on port 8000
- Check CORS: backend main.py has CORSMiddleware configured

**No diseases in form?**
- Verify PostgreSQL container is running: `docker ps`
- Check migrations ran: `docker compose logs api` look for Alembic messages
- Confirm seed file was loaded: `docker compose logs db`

**Dashboard shows no data?**
- Submit at least one report via the `/submit` form first
- Allow a few seconds for backend processing
- Check browser console for API errors

---

## 📦 Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TanStack Query + TypeScript |
| Backend | FastAPI (Python 3.11) + SQLAlchemy 2.0 + AsyncIO |
| Database | PostgreSQL 15 + PostGIS 3.3 |
| Containerization | Docker + Docker Compose |
| API Style | RESTful JSON with Pydantic validation |

---

**Ready for demo! 🚀**
