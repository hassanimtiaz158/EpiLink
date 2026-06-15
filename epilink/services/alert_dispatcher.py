import asyncio
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.alert import Alert
from models.case_report import CaseReport
from services.anomaly import AlertLevel

logger = logging.getLogger("epilink.alert_dispatcher")


async def trigger_immediate_alert(
    db: AsyncSession,
    report: CaseReport,
    alert_level: AlertLevel,
    z_score: float,
    confidence: float,
):
    max_id_result = await db.execute(select(func.max(Alert.id)))
    max_id = max_id_result.scalar()

    if max_id is None:
        next_seq = 1
    else:
        next_seq = int(max_id.split("-")[1]) + 1

    alert_id = f"EB-{next_seq:04d}"

    alert = Alert(
        id=alert_id,
        case_report_id=report.id,
        icd10_code=report.icd10_code,
        governorate=report.governorate,
        alert_level=alert_level.value,
        z_score=z_score,
        confidence=confidence,
        status="PENDING_HUMAN_REVIEW",
        dispatched_at=datetime.now(timezone.utc),
    )
    db.add(alert)
    await db.commit()

    payload = {
        "alert_id": alert_id,
        "icd10": report.icd10_code,
        "disease_name": report.disease_name,
        "governorate": report.governorate,
        "alert_level": alert_level.value,
        "z_score": z_score,
        "confidence": confidence,
        "submitted_at": report.submitted_at.isoformat(),
    }

    async def post_webhook(url: str, label: str):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
        except Exception as e:
            logger.warning(f"Webhook to {label} ({url}) failed: {e}")

    await post_webhook(settings.ministry_webhook_url, "Ministry")
    asyncio.create_task(post_webhook(settings.who_webhook_url, "WHO"))

    logger.info(
        f"Alert {alert_id} dispatched — Level: {alert_level.value}, "
        f"Disease: {report.icd10_code}, Governorate: {report.governorate}"
    )

    return alert
