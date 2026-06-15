import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import async_session_factory
from models.drift_report import DriftReport
from models.alert import Alert
from models.case_report import CaseReport

logger = logging.getLogger("epilink.drift_monitor")


async def weekly_drift_check(db: AsyncSession) -> DriftReport:
    now = datetime.now(timezone.utc)
    week_start = (now - timedelta(days=now.weekday())).date()

    window_start = datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc)
    window_end = window_start + timedelta(days=7)

    reports_stmt = select(func.count(CaseReport.id)).where(
        CaseReport.submitted_at >= window_start,
        CaseReport.submitted_at < window_end,
    )
    reports_result = await db.execute(reports_stmt)
    reports_this_week = reports_result.scalar() or 0

    alerts_stmt = select(func.count(Alert.id)).where(
        Alert.created_at >= window_start,
        Alert.created_at < window_end,
    )
    alerts_result = await db.execute(alerts_stmt)
    alerts_this_week = alerts_result.scalar() or 0

    alert_rate = alerts_this_week / max(reports_this_week, 1)

    if 0.005 < alert_rate < 0.15:
        alert_rate_status = "NORMAL"
    else:
        alert_rate_status = "DRIFT_DETECTED"

    mean_confidence_stmt = select(func.avg(Alert.confidence)).where(
        Alert.created_at >= window_start,
        Alert.created_at < window_end,
    )
    mean_confidence_result = await db.execute(mean_confidence_stmt)
    mean_confidence = mean_confidence_result.scalar() or 0.0
    mean_confidence = float(mean_confidence)

    approved_stmt = select(func.count(Alert.id)).where(
        Alert.created_at >= window_start,
        Alert.created_at < window_end,
        Alert.reviewer_decision == "APPROVED",
    )
    rejected_stmt = select(func.count(Alert.id)).where(
        Alert.created_at >= window_start,
        Alert.created_at < window_end,
        Alert.reviewer_decision == "REJECTED",
    )
    approved_result = await db.execute(approved_stmt)
    rejected_result = await db.execute(rejected_stmt)
    approved_count = approved_result.scalar() or 0
    rejected_count = rejected_result.scalar() or 0

    total_reviewed = approved_count + rejected_count
    if total_reviewed > 0:
        confirmation_rate = approved_count / total_reviewed
    else:
        confirmation_rate = 1.0

    drift_detected = alert_rate_status == "DRIFT_DETECTED" or confirmation_rate < 0.70

    drift_report = DriftReport(
        week_start=week_start,
        alert_rate=alert_rate,
        alert_rate_status=alert_rate_status,
        mean_confidence=mean_confidence,
        human_confirmation_rate=confirmation_rate,
        drift_detected=drift_detected,
        admin_notified=False,
    )
    db.add(drift_report)
    await db.commit()

    if drift_detected:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    settings.admin_webhook_url,
                    json={
                        "drift_id": drift_report.id,
                        "week_start": week_start.isoformat(),
                        "alert_rate": alert_rate,
                        "alert_rate_status": alert_rate_status,
                        "mean_confidence": mean_confidence,
                        "confirmation_rate": confirmation_rate,
                    },
                )
            drift_report.admin_notified = True
            await db.commit()
        except Exception as e:
            logger.error(f"Admin webhook failed: {e}")

    logger.info(
        f"Weekly drift check: week_start={week_start}, "
        f"alert_rate={alert_rate:.4f}, drift_detected={drift_detected}"
    )

    return drift_report


async def scheduled_drift_check():
    async with async_session_factory() as db:
        await weekly_drift_check(db)
