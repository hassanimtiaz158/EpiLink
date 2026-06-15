import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core import database as core_db
from core.database import get_db
from core.security import hash_physician_id
from models.case_report import CaseReport
from schemas.report import ReportSchema
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
        return Response(
            content='<?xml version="1.0" encoding="UTF-8"?><Response><Message>EpiLink ERROR: Empty SMS body</Message></Response>',
            media_type="application/xml",
            status_code=200,
        )

    if settings.environment != "development":
        from twilio.request_validator import RequestValidator
        validator = RequestValidator(settings.twilio_auth_token)
        signature = request.headers.get("X-Twilio-Signature", "")
        url = str(request.url)
        params = dict(await request.form())
        if not validator.validate(url, params, signature):
            return Response(
                content='<?xml version="1.0" encoding="UTF-8"?><Response><Message>EpiLink ERROR: Invalid signature</Message></Response>',
                media_type="application/xml",
                status_code=200,
            )

    parsed = parse_sms(body)
    if parsed is None:
        return Response(
            content='<?xml version="1.0" encoding="UTF-8"?><Response><Message>EpiLink ERROR: Invalid format. Expected RPT#FACILITYID#ICD10#AGEGROUP#SEX#OUTCOME</Message></Response>',
            media_type="application/xml",
            status_code=200,
        )

    if not await validate_icd10(db, parsed["icd10_code"]):
        return Response(
            content=f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>EpiLink ERROR: ICD-10 code {parsed["icd10_code"]} not found</Message></Response>',
            media_type="application/xml",
            status_code=200,
        )

    reporting_group = classify_reporting_group(parsed["icd10_code"])
    disease_name = await get_disease_name(db, parsed["icd10_code"])
    hashed_physician = hash_physician_id(parsed["physician_id"])

    submitted_at = datetime.now(timezone.utc)
    epi_week = submitted_at.isocalendar()[1]
    report_id = uuid.uuid4()

    report = CaseReport(
        id=uuid.uuid4(),
        report_id=report_id,
        submitted_at=submitted_at,
        epi_week=epi_week,
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
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    msg = f"EpiLink: Report received. ID: {str(report_id)[:8]}."
    if reporting_group == "A":
        msg += " Group A alert dispatched."
        asyncio.create_task(process_sms_group_a_alert(report))

    # Always run anomaly check
    asyncio.create_task(process_sms_anomaly_check(report))

    return Response(
        content=f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{msg}</Message></Response>',
        media_type="application/xml",
        status_code=200,
    )


async def process_sms_group_a_alert(report: CaseReport):
    try:
        async with core_db.async_session_factory() as session:
            alert_level, z_score, confidence = await detector.check_cluster(
                session, report.governorate, report.icd10_code
            )
            await trigger_immediate_alert(session, report, alert_level, z_score, confidence)
    except Exception as e:
        logger.exception(f"SMS Group A alert processing failed: {e}")


async def process_sms_anomaly_check(report: CaseReport):
    try:
        async with core_db.async_session_factory() as session:
            await detector.check_cluster(session, report.governorate, report.icd10_code)
    except Exception as e:
        logger.exception(f"SMS anomaly check failed: {e}")