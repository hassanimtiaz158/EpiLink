# EpiLink — Agent Instructions

> Egypt Disease Surveillance System. Read before coding.
> Also see `specs/AGENT_RULES.md` for deeper architecture details.

## Commands

```powershell
# Backend tests (27 tests, uses SQLite, no PostgreSQL needed)
cd epilink
pytest tests/ -v

# Single test file
pytest tests/test_classifier.py -v

# Backend dev server
uvicorn main:app --reload

# Frontend
cd frontend
npm install   # or bun install
npm run dev   # http://localhost:5173
npx tsc --noEmit   # type-check
npm run lint       # eslint + prettier
```

## Architecture

- **Backend:** FastAPI + SQLAlchemy 2.0 async + PostgreSQL/PostGIS. Tests use SQLite in-memory via `aiosqlite`.
- **Frontend:** TanStack Start (React 19) + TanStack Router + TailwindCSS v4. Vite via `@lovable.dev/vite-tanstack-config`.
- **Entry point:** `epilink/main.py` registers routers. `frontend/src/routes/` for pages.
- **API prefix:** All endpoints are `/api/v1/...` or `/api/input/...`. Frontend registry at `src/lib/api/config.ts`.

## Critical Rules

### Backend

- **All DB queries are async.** Zero sync ORM calls. Use `async with async_session()` or `Depends(get_db)`.
- **`physician_id` must be hashed** via `core.security.hash_physician_id()` before any DB write. Never store raw.
- **No `date_trunc()`** — it's PostgreSQL-only and breaks SQLite tests. Use Python `>= / <` range filters.
- **UUID columns:** Use SQLAlchemy 2.0 `Uuid` type, NOT `postgresql.UUID`.
- **ICD-10 B26 collision:** `B26_MU` = Mumps (Group A), `B26` = Viral Hepatitis (Group B). Match full code string.
- **Error responses:** `{"error": "human readable", "code": "MACHINE_CODE"}`. No FastAPI defaults.
- **Group A alerts:** Fire-and-forget via `asyncio.create_task()`. Never `await` dispatch in request handler.
- **Epi week:** Computed at insert: `submitted_at.isocalendar()[1]`. Never accept from request body.

### Frontend

- **Path alias:** `@/*` maps to `./src/*`.
- **Theme:** Light/dark via `use-theme.tsx` hook. CSS variables in `styles.css`. Persists in localStorage.
- **react-leaflet-cluster:** No TS declarations; loaded dynamically.
- **Prettier:** 100 chars, double quotes, trailing commas.

### Testing

- **conftest.py patch order is critical:** Patch `core.database.async_session_factory` BEFORE importing `main`.
- **File-based SQLite:** `sqlite+aiosqlite:///path/to/test.db` (not `:memory:` — in-memory is per-connection).
- **`httpx_mock`:** Register ALL expected responses BEFORE the test request. Unregistered calls raise.
- **After Group A submissions:** `await asyncio.sleep(0.1)` before asserting on webhooks/alerts.

## Known Issues

- **googletrans==4.0.0-rc1** is installed but **broken** with current httpcore. `translation.py` uses OpenAI or heuristic fallback. Do not import googletrans.
- **Tesseract** not installed on dev. OCR service returns empty text gracefully.
- **No PostgreSQL** running locally — tests use SQLite. Docker compose brings up PostGIS.

## File Map

```
epilink/
  main.py                 # App entrypoint, lifespan, router registration
  core/config.py          # Pydantic Settings
  core/database.py        # async engine, session factory, get_db
  core/security.py        # physician_id hashing
  services/               # classifier, anomaly, drift, ocr, translation, ai_parser
  routers/                # health, report, alert, dashboard, sms, input, reference
  schemas/                # Pydantic request/response models
  tests/                  # 27 tests (conftest patches before import)

frontend/src/
  lib/api/                # config.ts, services.ts, types.ts, client.ts
  hooks/                  # use-theme.tsx, use-online.tsx
  components/layout/      # AppShell.tsx
  routes/                 # index, submit, alerts, review, dashboard, health, analysis
```
