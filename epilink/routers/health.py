from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import select, func

from core.database import async_session_factory

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    db_status = "connected"
    try:
        async with async_session_factory() as db:
            await db.execute(select(func.now()))
    except Exception:
        db_status = "disconnected"

    return {
        "status": "ok",
        "db": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
