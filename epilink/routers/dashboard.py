import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.alert import Alert
from models.case_report import CaseReport
from schemas.alert import AlertOut, DashboardOut

logger = logging.getLogger("epilink.dashboard_router")

router = APIRouter(prefix="/api/v1", tags=["dashboard"])


def _current_week_bounds() -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)
    return week_start, week_end


@router.get("/dashboard", response_model=DashboardOut)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    week_start, week_end = _current_week_bounds()

    total_stmt = select(func.count(CaseReport.id)).where(
        CaseReport.submitted_at >= week_start,
        CaseReport.submitted_at < week_end,
    )
    total_result = await db.execute(total_stmt)
    total_reports_this_week = total_result.scalar() or 0

    active_alerts_stmt = select(func.count(Alert.id)).where(
        Alert.status == "PENDING_HUMAN_REVIEW"
    )
    active_result = await db.execute(active_alerts_stmt)
    active_group_a_alerts = active_result.scalar() or 0

    alerts_week_stmt = select(func.count(Alert.id)).where(
        Alert.created_at >= week_start,
        Alert.created_at < week_end,
    )
    alerts_week_result = await db.execute(alerts_week_stmt)
    alerts_this_week = alerts_week_result.scalar() or 0
    alert_rate = alerts_this_week / max(total_reports_this_week, 1)

    mean_conf_stmt = select(func.avg(Alert.confidence)).where(
        Alert.created_at >= week_start,
        Alert.created_at < week_end,
    )
    mean_conf_result = await db.execute(mean_conf_stmt)
    mean_confidence = float(mean_conf_result.scalar() or 0.0)

    gov_stmt = (
        select(CaseReport.governorate, func.count(CaseReport.id).label("cnt"))
        .where(
            CaseReport.submitted_at >= week_start,
            CaseReport.submitted_at < week_end,
        )
        .group_by(CaseReport.governorate)
        .order_by(func.count(CaseReport.id).desc())
    )
    gov_result = await db.execute(gov_stmt)
    reports_by_governorate = [
        {"governorate": row.governorate, "count": row.cnt}
        for row in gov_result.all()
    ]

    recent_alerts_stmt = (
        select(Alert)
        .order_by(Alert.created_at.desc())
        .limit(10)
    )
    recent_result = await db.execute(recent_alerts_stmt)
    recent_alerts = recent_result.scalars().all()

    return DashboardOut(
        total_reports_this_week=total_reports_this_week,
        active_group_a_alerts=active_group_a_alerts,
        alert_rate=alert_rate,
        mean_confidence=mean_confidence,
        reports_by_governorate=reports_by_governorate,
        recent_alerts=[AlertOut.model_validate(a) for a in recent_alerts],
    )
