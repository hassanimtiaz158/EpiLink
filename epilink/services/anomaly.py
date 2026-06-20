import math
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.case_report import CaseReport
from models.baseline_cache import BaselineCache


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

    async def _get_baseline_from_cache(
        self, db: AsyncSession, governorate: str, icd10_prefix: str, epi_week: int
    ) -> Optional[tuple[float, float, int]]:
        """Get pre-computed baseline from baseline_cache."""
        result = await db.execute(
            select(BaselineCache).where(
                BaselineCache.governorate == governorate,
                BaselineCache.icd10_prefix == icd10_prefix,
                BaselineCache.epi_week == epi_week,
            )
        )
        baseline = result.scalar_one_or_none()
        if baseline:
            return (baseline.baseline_mean, baseline.baseline_std, baseline.data_points)
        return None

    async def _compute_baseline(
        self, db: AsyncSession, governorate: str, icd10_prefix: str, epi_week: int
    ) -> tuple[float, float, int]:
        """Compute seasonal baseline from historical case_reports (3-year rolling window)."""
        now = datetime.now(timezone.utc)
        three_years_ago = now - timedelta(days=3 * 365)
        baseline_start = three_years_ago - timedelta(weeks=4)

        # Get all historical weeks for this governorate, icd10_prefix, and epi_week
        counts = []
        for ws, we in _week_boundaries(baseline_start, three_years_ago):
            if ws.isocalendar()[1] != epi_week:
                continue
            stmt = select(func.count(CaseReport.id)).where(
                CaseReport.governorate == governorate,
                CaseReport.icd10_code.like(f"{icd10_prefix}%"),
                CaseReport.submitted_at >= ws,
                CaseReport.submitted_at < we,
            )
            result = await db.execute(stmt)
            cnt = result.scalar() or 0
            counts.append(cnt)

        valid_counts = [c for c in counts if c > 0]
        if len(valid_counts) < 4:
            return (0.0, 0.0, len(valid_counts))

        mean = sum(valid_counts) / len(valid_counts)
        if len(valid_counts) > 1:
            variance = sum((x - mean) ** 2 for x in valid_counts) / len(valid_counts)
            std = math.sqrt(variance)
        else:
            std = 0.0

        # Cache the computed baseline
        cache_entry = BaselineCache(
            governorate=governorate,
            icd10_prefix=icd10_prefix,
            epi_week=epi_week,
            baseline_mean=mean,
            baseline_std=std,
            data_points=len(valid_counts),
        )
        db.add(cache_entry)
        await db.commit()

        return (mean, std, len(valid_counts))

    async def check_cluster(
        self, db: AsyncSession, governorate: str, icd10: str
    ) -> tuple[AlertLevel, float, float]:
        now = datetime.now(timezone.utc)
        four_weeks_ago = now - timedelta(weeks=4)

        icd10_prefix = icd10[:3] if len(icd10) >= 3 else icd10

        # Get recent 4-week counts
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

        # Get baseline for current epi_week
        current_epi_week = now.isocalendar()[1]

        baseline_data = await self._get_baseline_from_cache(
            db, governorate, icd10_prefix, current_epi_week
        )

        if baseline_data is None:
            baseline_data = await self._compute_baseline(
                db, governorate, icd10_prefix, current_epi_week
            )

        baseline_mean, baseline_std, data_points = baseline_data

        confidence = min(1.0, recent_sample_size / 10.0)

        if data_points < 4:
            if recent_sample_size >= 3:
                return (AlertLevel.REVIEW, 0.0, confidence)
            else:
                return (AlertLevel.NORMAL, 0.0, confidence)

        if baseline_std == 0.0:
            baseline_std = 0.001

        z_score = (recent_mean - baseline_mean) / baseline_std

        if z_score > self.threshold and confidence >= self.confidence_threshold:
            return (AlertLevel.HIGH, z_score, confidence)
        elif z_score > self.threshold and confidence < self.confidence_threshold:
            return (AlertLevel.REVIEW, z_score, confidence)
        else:
            return (AlertLevel.NORMAL, z_score, confidence)