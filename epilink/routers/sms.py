import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core import database as core_db
from core.database import get_db
from core.security import hash_physician_id
from models.case_report import CaseReport
from services.alert_dispatcher import trigger_immediate_alert
from services.anomaly import OutbreakDetector
from services.classifier import (
    classify_reporting_group,
    get_disease_name,
    validate_icd10,
)
from services.sms_parser import parse_sms

logger = logging.getLogger("epilink.sms_router")
detector = OutbreakDetector()

router = APIRouter(prefix="/api/v1", tags=["sms"])


@router.post("/sms-webhook")
async def sms_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    form = await request.form()
    body = form.get("Body", "")

    if not body:
        raise HTTPException(
            status_code=400,
            detail={"error": "Empty SMS body", "code": "INVALID_SMS"},
        )

    if settings.environment != "development":
        from twilio.request_validator import RequestValidator
        validator = RequestValidator(settings.twilio_auth_token)
        signature = request.headers.get("X-Twilio-Signature", "")
        url = str(request.url)
        params = dict(await request.form())
        if not validator.validate(url, params, signature):
            raise HTTPException(
                status_code=403,
                detail={"error": "Invalid Twilio signature", "code": "FORBIDDEN"},
            )

    try:
        parsed = parse_sms(body)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": str(e), "code": "INVALID_SMS"},
        )

    if not await validate_icd10(db, parsed["icd10_code"]):
        raise HTTPException(
            status_code=400,
            detail={"error": f"ICD-10 code {parsed['icd10_code']} not found", "code": "INVALID_ICD10"},
        )

    reporting_group = await classify_reporting_group(db, parsed["icd10_code"])
    disease_name = await get_disease_name(db, parsed["icd10_code"])
    hashed_physician = hash_physician_id(parsed["physician_id"])

    submitted_at = datetime.now(timezone.utc)
    epi_week = submitted_at.isocalendar()[1]
    report_id = uuid.uuid4()

    report = CaseReport(
        id=uuid.uuid4(),
        report_id=report_id,
        submitted_at=submitted_at,
        facility_id=parsed["facility_id"],
        physician_id=hashed_physician,
        governorate=parsed["governorate"],
        district=parsed["district"],
        age_group=parsed["age_group"],
        sex=parsed["sex"],
        nationality=parsed["nationality"],
        icd10_code=parsed["icd10_code"],
        disease_name=disease_name,
        reporting_group=reporting_group,
        symptom_onset_date=parsed["symptom_onset_date"],
        diagnosis_basis=parsed["diagnosis_basis"],
        hospitalized=parsed["hospitalized"],
        outcome=parsed["outcome"],
        lab_sample_taken=parsed["lab_sample_taken"],
        submission_mode=parsed["submission_mode"],
        epi_week=epi_week,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    if reporting_group == "A":
        asyncio.create_task(
            process_sms_group_a_alert(report)
        )

    return """<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>Report received</Message></Response>"""


async def process_sms_group_a_alert(report: CaseReport):
    try:
        async with core_db.async_session_factory() as session:
            alert_level, z_score, confidence = await detector.check_cluster(
                session, report.governorate, report.icd10_code
            )
            await trigger_immediate_alert(session, report, alert_level, z_score, confidence)
    except Exception as e:
        logger.exception(f"SMS Group A alert processing failed: {e}")
