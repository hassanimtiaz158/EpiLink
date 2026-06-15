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


async def weekly_drift_check(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    week_start = (now - timedelta(days=now.weekday())).date()
    week_end = week_start + timedelta(days=7)

    window_start = datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc)
    window_end = datetime.combine(week_end, datetime.min.time(), tzinfo=timezone.utc)

    # Total reports this week
    reports_stmt = select(func.count(CaseReport.id)).where(
        CaseReport.submitted_at >= window_start,
        CaseReport.submitted_at < window_end,
    )
    reports_result = await db.execute(reports_stmt)
    reports_this_week = reports_result.scalar() or 0

    # Total alerts this week
    alerts_stmt = select(func.count(Alert.id)).where(
        Alert.created_at >= window_start,
        Alert.created_at < window_end,
    )
    alerts_result = await db.execute(alerts_stmt)
    alerts_this_week = alerts_result.scalar() or 0

    alert_rate = alerts_this_week / max(reports_this_week, 1)

    if 0.005 <= alert_rate <= 0.15:
        alert_rate_status = "NORMAL"
    else:
        alert_rate_status = "DRIFT_DETECTED"

    # Mean confidence across all anomaly checks this week
    mean_confidence_stmt = select(func.avg(Alert.confidence)).where(
        Alert.created_at >= window_start,
        Alert.created_at < window_end,
    )
    mean_confidence_result = await db.execute(mean_confidence_stmt)
    mean_confidence = mean_confidence_result.scalar() or 0.0
    mean_confidence = float(mean_confidence)

    # Human confirmation rate from reviewed REVIEW-level alerts
    confirmed_stmt = select(func.count(Alert.id)).where(
        Alert.created_at >= window_start,
        Alert.created_at < window_end,
        Alert.review_decision == "confirmed",
    )
    dismissed_stmt = select(func.count(Alert.id)).where(
        Alert.created_at >= window_start,
        Alert.created_at < window_end,
        Alert.review_decision == "dismissed",
    )
    confirmed_result = await db.execute(confirmed_stmt)
    dismissed_result = await db.execute(dismissed_stmt)
    confirmed_count = confirmed_result.scalar() or 0
    dismissed_count = dismissed_result.scalar() or 0

    total_reviewed = confirmed_count + dismissed_count
    if total_reviewed > 0:
        confirmation_rate = confirmed_count / total_reviewed
    else:
        confirmation_rate = 0.0

    drift_detected = alert_rate_status == "DRIFT_DETECTED"

    # Quarterly baseline recalibration check
    baseline_recalibrated = False
    if is_quarter_end(week_start):
        await recalibrate_seasonal_baseline(db)
        baseline_recalibrated = True

    drift_report = DriftReport(
        week_start=week_start,
        week_end=week_end,
        total_reports=reports_this_week,
        total_alerts=alerts_this_week,
        alert_rate=alert_rate,
        alert_rate_status=alert_rate_status,
        mean_confidence=mean_confidence,
        human_confirmation_rate=confirmation_rate if total_reviewed > 0 else None,
        baseline_recalibrated=baseline_recalibrated,
        drift_detected=drift_detected,
    )
    db.add(drift_report)
    await db.commit()
    await db.refresh(drift_report)

    if drift_detected:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    settings.admin_webhook_url,
                    json={
                        "drift_id": str(drift_report.id),
                        "week_start": week_start.isoformat(),
                        "week_end": week_end.isoformat(),
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

    return {
        "id": str(drift_report.id),
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "total_reports": reports_this_week,
        "total_alerts": alerts_this_week,
        "alert_rate": alert_rate,
        "alert_rate_status": alert_rate_status,
        "mean_confidence": mean_confidence,
        "confirmation_rate": confirmation_rate,
        "drift_detected": drift_detected,
        "baseline_recalibrated": baseline_recalibrated,
    }


def is_quarter_end(week_start_date) -> bool:
    """Check if the week_start is at the end of a quarter (March, June, September, December)."""
    quarter_end_months = [3, 6, 9, 12]
    return week_start_date.month in quarter_end_months


async def recalibrate_seasonal_baseline(db: AsyncSession) -> int:
    """Recalculate all seasonal baselines on 3-year rolling window."""
    from models.baseline_cache import BaselineCache
    from models.case_report import CaseReport

    now = datetime.now(timezone.utc)
    three_years_ago = now - timedelta(days=3 * 365)
    baseline_start = three_years_ago - timedelta(weeks=4)

    # Get unique governorate/icd10_prefix/epi_week combinations from case_reports
    stmt = (
        select(
            CaseReport.governorate,
            func.substr(CaseReport.icd10_code, 1, 3).label("icd10_prefix"),
            CaseReport.epi_week,
        )
        .where(CaseReport.submitted_at >= baseline_start)
        .distinct()
    )
    result = await db.execute(stmt)
    combinations = result.all()

    recalibrated = 0
    for gov, prefix, epi_week in combinations:
        if epi_week is None:
            continue

        counts = []
        for ws, we in _week_boundaries(baseline_start, three_years_ago):
            if ws.isocalendar()[1] != epi_week:
                continue
            stmt = select(func.count(CaseReport.id)).where(
                CaseReport.governorate == gov,
                CaseReport.icd10_code.like(f"{prefix}%"),
                CaseReport.submitted_at >= ws,
                CaseReport.submitted_at < we,
            )
            result = await db.execute(stmt)
            cnt = result.scalar() or 0
            counts.append(cnt)

        valid_counts = [c for c in counts if c > 0]
        if len(valid_counts) < 4:
            continue

        mean = sum(valid_counts) / len(valid_counts)
        variance = sum((x - mean) ** 2 for x in valid_counts) / len(valid_counts)
        std = variance ** 0.5 if len(valid_counts) > 1 else 0.0

        # Upsert into baseline_cache
        await db.execute(
            BaselineCache.__table__.insert().values(
                governorate=gov,
                icd10_prefix=prefix,
                epi_week=epi_week,
                baseline_mean=mean,
                baseline_std=std,
                data_points=len(valid_counts),
                computed_at=datetime.now(timezone.utc),
            ).on_conflict_do_update(
                index_elements=["governorate", "icd10_prefix", "epi_week"],
                set_=dict(
                    baseline_mean=mean,
                    baseline_std=std,
                    data_points=len(valid_counts),
                    computed_at=datetime.now(timezone.utc),
                ),
            )
        )
        recalibrated += 1

    await db.commit()
    logger.info(f"Recalibrated {recalibrated} seasonal baselines")
    return recalibrated


def _week_boundaries(from_date: datetime, to_date: datetime):
    """Yield (week_start, week_end) tuples covering the range."""
    cursor = from_date - timedelta(days=from_date.weekday())
    cursor = cursor.replace(hour=0, minute=0, second=0, microsecond=0)
    while cursor < to_date:
        week_end = cursor + timedelta(days=7)
        yield cursor, week_end
        cursor = week_end


async def scheduled_drift_check():
    async with async_session_factory() as db:
        await weekly_drift_check(db)