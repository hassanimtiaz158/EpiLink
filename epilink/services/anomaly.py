import math
from datetime import datetime, timedelta, timezone
from enum import Enum

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.case_report import CaseReport


class AlertLevel(str, Enum):
    HIGH = "HIGH"
    REVIEW = "REVIEW"
    NORMAL = "NORMAL"


def _week_boundaries(from_date: datetime, to_date: datetime):
    """Yield (week_start, week_end) tuples covering the range."""
    cursor = from_date - timedelta(days=from_date.weekday())
    cursor = cursor.replace(hour=0, minute=0, second=0, microsecond=0)
    while cursor < to_date:
        week_end = cursor + timedelta(days=7)
        yield cursor, week_end
        cursor = week_end


class OutbreakDetector:
    threshold: float = 2.5
    confidence_threshold: float = 0.85

    async def check_cluster(
        self, db: AsyncSession, governorate: str, icd10: str
    ) -> tuple[AlertLevel, float, float]:
        now_result = await db.execute(select(func.now()))
        now: datetime = now_result.scalar()

        four_weeks_ago = now - timedelta(weeks=4)
        three_years_ago = now - timedelta(days=3 * 365)
        baseline_start = three_years_ago - timedelta(weeks=4)

        recent_counts = []
        for ws, we in _week_boundaries(four_weeks_ago, now):
            stmt = select(func.count(CaseReport.id)).where(
                CaseReport.governorate == governorate,
                CaseReport.icd10_code == icd10,
                CaseReport.submitted_at >= ws,
                CaseReport.submitted_at < we,
            )
            result = await db.execute(stmt)
            cnt = result.scalar() or 0
            recent_counts.append(cnt)

        recent_values = [c for c in recent_counts if c > 0]
        if not recent_values:
            return (AlertLevel.NORMAL, 0.0, 0.0)

        recent_mean = sum(recent_values) / len(recent_values)
        recent_sample_size = sum(recent_values)

        baseline_counts = []
        for ws, we in _week_boundaries(baseline_start, three_years_ago):
            stmt = select(func.count(CaseReport.id)).where(
                CaseReport.governorate == governorate,
                CaseReport.icd10_code == icd10,
                CaseReport.submitted_at >= ws,
                CaseReport.submitted_at < we,
            )
            result = await db.execute(stmt)
            cnt = result.scalar() or 0
            baseline_counts.append(cnt)

        baseline_values = [c for c in baseline_counts if c > 0]
        if len(baseline_values) < 4:
            return (AlertLevel.NORMAL, 0.0, 0.0)

        baseline_mean = sum(baseline_values) / len(baseline_values)

        if len(baseline_values) > 1:
            variance = sum((x - baseline_mean) ** 2 for x in baseline_values) / len(baseline_values)
            baseline_std = math.sqrt(variance)
        else:
            baseline_std = 0.0

        z_score = (recent_mean - baseline_mean) / (baseline_std + 0.001)
        confidence = min(1.0, recent_sample_size / 10.0)

        if z_score > self.threshold and confidence >= self.confidence_threshold:
            return (AlertLevel.HIGH, z_score, confidence)
        elif z_score > self.threshold and confidence < self.confidence_threshold:
            return (AlertLevel.REVIEW, z_score, confidence)
        else:
            return (AlertLevel.NORMAL, z_score, confidence)
