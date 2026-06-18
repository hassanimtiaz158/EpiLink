import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers.health import router as health_router
from routers.report import router as report_router
from routers.alert import router as alert_router
from routers.dashboard import router as dashboard_router
from routers.sms import router as sms_router
from routers.reference import router as reference_router
from services.drift_monitor import scheduled_drift_check

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("epilink")


scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        scheduled_drift_check,
        "cron",
        day_of_week="sun",
        hour=0,
        minute=0,
        timezone="UTC",
    )
    scheduler.start()
    logger.info("APScheduler started — weekly drift check scheduled for Sunday 00:00 UTC")
    logger.info("EpiLink API started — Egypt DES surveillance system")
    yield
    scheduler.shutdown()
    logger.info("APScheduler stopped")


app = FastAPI(
    title="EpiLink",
    description="Egypt Disease Surveillance System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(report_router)
app.include_router(alert_router)
app.include_router(dashboard_router)
app.include_router(sms_router)
app.include_router(reference_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "code": "INTERNAL_ERROR"},
    )
