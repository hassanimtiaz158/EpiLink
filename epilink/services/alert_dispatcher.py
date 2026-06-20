import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.alert import Alert
from services.anomaly import AlertLevel

logger = logging.getLogger("epilink.alert_dispatcher")


def _build_fhir_bundle(alert: Alert, report) -> dict:
    """Build HL7 FHIR Bundle for WHO notification."""
    return {
        "resourceType": "Bundle",
        "type": "message",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "entry": [
            {
                "resource": {
                    "resourceType": "MessageHeader",
                    "id": str(alert.id),
                    "eventCoding": {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                        "code": "ALERT",
                        "display": "Alert",
                    },
                    "destination": [{"endpoint": settings.who_fhir_url}],
                    "sender": {"reference": "Organization/epilink"},
                }
            },
            {
                "resource": {
                    "resourceType": "DiagnosticReport",
                    "status": "final",
                    "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v2-0074", "code": "ALERT"}]}],
                    "code": {"coding": [{"system": "http://hl7.org/fhir/sid/icd-10", "code": alert.icd10_code}]},
                    "subject": {"reference": f"Location/{alert.governorate}"},
                    "effectiveDateTime": alert.created_at.isoformat(),
                    "issued": alert.created_at.isoformat(),
                    "performer": [{"reference": "Organization/epilink"}],
                    "result": [
                        {"reference": f"Observation/{alert.id}-zscore", "display": f"Z-score: {alert.z_score}"},
                        {"reference": f"Observation/{alert.id}-confidence", "display": f"Confidence: {alert.confidence}"},
                    ],
                }
            },
        ],
    }


async def trigger_immediate_alert(
    db: AsyncSession,
    report,
    alert_level: AlertLevel,
    z_score: float,
    confidence: float,
) -> Alert:
    alert_id = uuid.uuid4()

    alert = Alert(
        id=alert_id,
        case_report_id=report.id,
        icd10_code=report.icd10_code,
        governorate=report.governorate,
        alert_level=alert_level.value,
        z_score=z_score,
        confidence=confidence,
        status="pending",
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)

    logger.info(
        f"Alert {alert_id} created (pending review) — Level: {alert_level.value}, "
        f"Disease: {report.icd10_code}, Governorate: {report.governorate}, "
        f"Z-score: {z_score:.2f}, Confidence: {confidence:.2f}"
    )

    return alert


async def dispatch_alert_record(alert: Alert):
    """Dispatch an existing alert record (used when review confirms)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            payload = {
                "alert_id": str(alert.id),
                "icd10": alert.icd10_code,
                "governorate": alert.governorate,
                "alert_level": alert.alert_level,
                "z_score": float(alert.z_score) if alert.z_score else None,
                "confidence": float(alert.confidence) if alert.confidence else None,
            }
            await client.post(settings.ministry_webhook_url, json=payload)
            fhir_payload = {
                "resourceType": "Bundle",
                "type": "message",
                "entry": [{"resource": {"resourceType": "DiagnosticReport", "status": "final"}}],
            }
            await client.post(settings.who_fhir_url + "/Bundle", json=fhir_payload)
    except Exception as e:
        logger.warning(f"Dispatch for confirmed alert failed: {e}")