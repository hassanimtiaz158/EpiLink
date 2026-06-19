import logging
import os
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

from core.config import settings
from core.database import async_session_factory
from models.disease_registry import DiseaseRegistry
from models.user import User
from routers.health import router as health_router
from routers.report import router as report_router
from routers.alert import router as alert_router
from routers.dashboard import router as dashboard_router
from routers.sms import router as sms_router
from routers.input import router as input_router
from routers.reference import router as reference_router
from routers.analysis import router as analysis_router
from routers.auth import router as auth_router
from services.drift_monitor import scheduled_drift_check
from core.security import hash_password

EGYPT_DES_DISEASES = [
    # Group A — Immediate alert
    {"icd10_code": "A80", "name": "Acute Flaccid Paralysis / Poliomyelitis", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A36", "name": "Diphtheria", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A37", "name": "Pertussis (Whooping Cough)", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A33", "name": "Neonatal Tetanus", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "U07.1", "name": "COVID-19", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "B34.2", "name": "MERS-CoV", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A39.0", "name": "Meningococcal Meningitis", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "G00", "name": "Bacterial Meningitis", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A87", "name": "Viral Meningitis", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A05.0", "name": "Acute Food Poisoning", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A82", "name": "Rabies", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A92.4", "name": "Rift Valley Fever", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A20", "name": "Plague", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "B50", "name": "Malaria (P. falciparum)", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "B51", "name": "Malaria (P. vivax)", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "B20", "name": "HIV / AIDS", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "U06.9", "name": "Zika Virus Disease", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "B04", "name": "Mpox (Monkeypox)", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "B05", "name": "Measles", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "B06", "name": "Rubella", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "B26_MU", "name": "Mumps", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "J09", "name": "Avian Influenza H5N1", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A00.1", "name": "Cholera", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A86", "name": "Viral Encephalitis", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A05.1", "name": "Botulism", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A22", "name": "Anthrax", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A98.0", "name": "Crimean-Congo Hemorrhagic Fever", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A92.3", "name": "West Nile Fever", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A98.4", "name": "Ebola Virus Disease", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A97", "name": "Dengue Hemorrhagic Fever", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "A95", "name": "Yellow Fever", "group_label": "A", "alert_minutes": 60},
    {"icd10_code": "PHE.ANY", "name": "Any Public Health Event of Concern", "group_label": "A", "alert_minutes": 60},
    # Group B — Weekly reporting
    {"icd10_code": "B26", "name": "Viral Hepatitis (A, B, C, E)", "group_label": "B", "alert_minutes": None},
    {"icd10_code": "A01.0", "name": "Typhoid Fever", "group_label": "B", "alert_minutes": None},
    {"icd10_code": "A04.0", "name": "Bloody Diarrhea / Dysentery", "group_label": "B", "alert_minutes": None},
    {"icd10_code": "A23", "name": "Brucellosis", "group_label": "B", "alert_minutes": None},
    {"icd10_code": "T01.9", "name": "Animal Bite", "group_label": "B", "alert_minutes": None},
    {"icd10_code": "B74", "name": "Filariasis", "group_label": "B", "alert_minutes": None},
    {"icd10_code": "B01", "name": "Chickenpox (Varicella)", "group_label": "B", "alert_minutes": None},
    {"icd10_code": "J10", "name": "Seasonal Influenza", "group_label": "B", "alert_minutes": None},
    {"icd10_code": "A15", "name": "Tuberculosis (TB)", "group_label": "B", "alert_minutes": None},
    {"icd10_code": "A30", "name": "Leprosy", "group_label": "B", "alert_minutes": None},
    {"icd10_code": "B55", "name": "Leishmaniasis", "group_label": "B", "alert_minutes": None},
    {"icd10_code": "B66", "name": "Fascioliasis", "group_label": "B", "alert_minutes": None},
    {"icd10_code": "B65", "name": "Schistosomiasis (Bilharzia)", "group_label": "B", "alert_minutes": None},
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("epilink")


scheduler = AsyncIOScheduler()


async def seed_diseases():
    async with async_session_factory() as session:
        result = await session.execute(select(DiseaseRegistry).limit(1))
        if result.scalars().first() is not None:
            return
        for d in EGYPT_DES_DISEASES:
            session.add(DiseaseRegistry(**d))
        await session.commit()
        logger.info(f"Seeded {len(EGYPT_DES_DISEASES)} Egypt DES diseases")


async def seed_admin_user():
    async with async_session_factory() as session:
        result = await session.execute(select(User).limit(1))
        if result.scalars().first() is not None:
            return
        admin = User(
            email="admin@epilink.gov.eg",
            hashed_password=hash_password("admin123"),
            full_name="System Admin",
            role="admin",
        )
        viewer = User(
            email="viewer@epilink.gov.eg",
            hashed_password=hash_password("viewer123"),
            full_name="Epi Viewer",
            role="viewer",
        )
        session.add(admin)
        session.add(viewer)
        await session.commit()
        logger.info("Seeded default users: admin@epilink.gov.eg / viewer@epilink.gov.eg")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.environment == "production":
        try:
            from alembic.config import Config
            from alembic import command
            alembic_cfg = Config(os.path.join(os.path.dirname(os.path.abspath(__file__)), "alembic.ini"))
            command.upgrade(alembic_cfg, "head")
            logger.info("Database migrations applied")
        except Exception as e:
            logger.warning(f"Migration skipped: {e}")
    await seed_diseases()
    await seed_admin_user()
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
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(report_router)
app.include_router(alert_router)
app.include_router(dashboard_router)
app.include_router(sms_router)
app.include_router(input_router)
app.include_router(reference_router)
app.include_router(analysis_router)
app.include_router(auth_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "code": "INTERNAL_ERROR"},
    )
