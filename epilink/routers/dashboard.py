import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import require_role
from models.alert import Alert
from models.case_report import CaseReport
from models.drift_report import DriftReport
from models.user import User
from schemas.alert import (
    AlertOut, DashboardOut, DashboardSummary, DashboardDrift,
    WeeklyTrendItem, TopDiseaseItem,
)

logger = logging.getLogger("epilink.dashboard_router")

router = APIRouter(prefix="/api/v1", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardOut)
async def get_dashboard(
    weeks: int = Query(4, ge=1, le=52),
    governorate: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("viewer", "epi_officer", "admin")),
):
    now = datetime.now(timezone.utc)
    current_week_start = now - timedelta(days=now.weekday())
    current_week_start = current_week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    current_week_end = current_week_start + timedelta(days=7)

    # Current week report count
    total_stmt = select(func.count(CaseReport.id)).where(
        CaseReport.submitted_at >= current_week_start,
        CaseReport.submitted_at < current_week_end,
    )
    if governorate:
        total_stmt = total_stmt.where(CaseReport.governorate == governorate)
    total_result = await db.execute(total_stmt)
    total_reports_this_week = total_result.scalar() or 0

    # Current week alerts count
    alerts_stmt = select(func.count(Alert.id)).where(
        Alert.created_at >= current_week_start,
        Alert.created_at < current_week_end,
    )
    if governorate:
        alerts_stmt = alerts_stmt.where(Alert.governorate == governorate)
    alerts_result = await db.execute(alerts_stmt)
    total_alerts_this_week = alerts_result.scalar() or 0

    alert_rate = total_alerts_this_week / max(total_reports_this_week, 1)
    alert_rate_status = "NORMAL" if 0.005 <= alert_rate <= 0.15 else "DRIFT_DETECTED"

    # Pending reviews
    pending_stmt = select(func.count(Alert.id)).where(Alert.status == "under_review")
    pending_result = await db.execute(pending_stmt)
    pending_reviews = pending_result.scalar() or 0

    # Mean confidence this week
    mean_conf_stmt = select(func.avg(Alert.confidence)).where(
        Alert.created_at >= current_week_start,
        Alert.created_at < current_week_end,
    )
    mean_conf_result = await db.execute(mean_conf_stmt)
    mean_confidence = float(mean_conf_result.scalar() or 0.0)

    # Weekly trend
    weekly_trend = []
    for w in range(weeks):
        ws = current_week_start - timedelta(weeks=w)
        we = ws + timedelta(days=7)

        week_total_stmt = select(func.count(CaseReport.id)).where(
            CaseReport.submitted_at >= ws,
            CaseReport.submitted_at < we,
        )
        if governorate:
            week_total_stmt = week_total_stmt.where(CaseReport.governorate == governorate)
        week_total = (await db.execute(week_total_stmt)).scalar() or 0

        week_a_stmt = select(func.count(CaseReport.id)).where(
            CaseReport.submitted_at >= ws,
            CaseReport.submitted_at < we,
            CaseReport.reporting_group == "A",
        )
        if governorate:
            week_a_stmt = week_a_stmt.where(CaseReport.governorate == governorate)
        week_a = (await db.execute(week_a_stmt)).scalar() or 0

        week_b_stmt = select(func.count(CaseReport.id)).where(
            CaseReport.submitted_at >= ws,
            CaseReport.submitted_at < we,
            CaseReport.reporting_group == "B",
        )
        if governorate:
            week_b_stmt = week_b_stmt.where(CaseReport.governorate == governorate)
        week_b = (await db.execute(week_b_stmt)).scalar() or 0

        week_alerts_stmt = select(func.count(Alert.id)).where(
            Alert.created_at >= ws,
            Alert.created_at < we,
        )
        if governorate:
            week_alerts_stmt = week_alerts_stmt.where(Alert.governorate == governorate)
        week_alerts = (await db.execute(week_alerts_stmt)).scalar() or 0

        epi_week = ws.isocalendar()[1]
        weekly_trend.append(WeeklyTrendItem(
            epi_week=epi_week,
            week_start=ws.date().isoformat(),
            total_reports=week_total,
            group_a_reports=week_a,
            group_b_reports=week_b,
            alerts_dispatched=week_alerts,
        ))

    # Top diseases this week
    top_stmt = (
        select(CaseReport.disease_name, CaseReport.icd10_code, func.count(CaseReport.id).label("cnt"))
        .where(
            CaseReport.submitted_at >= current_week_start,
            CaseReport.submitted_at < current_week_end,
        )
        .group_by(CaseReport.disease_name, CaseReport.icd10_code)
        .order_by(func.count(CaseReport.id).desc())
        .limit(5)
    )
    if governorate:
        top_stmt = top_stmt.where(CaseReport.governorate == governorate)
    top_result = await db.execute(top_stmt)
    top_diseases = [
        TopDiseaseItem(disease=row.disease_name, icd10=row.icd10_code, count=row.cnt)
        for row in top_result.all()
    ]

    # Recent alerts
    recent_alerts_stmt = (
        select(Alert)
        .order_by(Alert.created_at.desc())
        .limit(10)
    )
    if governorate:
        recent_alerts_stmt = recent_alerts_stmt.where(Alert.governorate == governorate)
    recent_result = await db.execute(recent_alerts_stmt)
    recent_alerts = [AlertOut.model_validate(a) for a in recent_result.scalars().all()]

    # Drift info from latest drift report
    drift_stmt = select(DriftReport).order_by(DriftReport.audit_run_at.desc()).limit(1)
    drift_result = await db.execute(drift_stmt)
    latest_drift = drift_result.scalars().first()

    if latest_drift:
        drift = DashboardDrift(
            last_audit=latest_drift.audit_run_at.isoformat() if latest_drift.audit_run_at else None,
            mean_confidence=float(latest_drift.mean_confidence) if latest_drift.mean_confidence else 0.0,
            human_confirmation_rate=float(latest_drift.human_confirmation_rate) if latest_drift.human_confirmation_rate else 0.0,
            status=latest_drift.alert_rate_status or "NORMAL",
        )
    else:
        drift = DashboardDrift()

    return DashboardOut(
        summary=DashboardSummary(
            total_reports_this_week=total_reports_this_week,
            total_alerts_this_week=total_alerts_this_week,
            alert_rate=alert_rate,
            alert_rate_status=alert_rate_status,
            pending_reviews=pending_reviews,
        ),
        weekly_trend=weekly_trend,
        top_diseases=top_diseases,
        recent_alerts=recent_alerts,
        drift=drift,
    )