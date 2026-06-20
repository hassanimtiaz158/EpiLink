import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from core import database as core_db
from core.database import get_db
from core.security import hash_physician_id, require_role
from models.case_report import CaseReport
from models.user import User
from schemas.report import ReportSchema, ReportResponse
from services.alert_dispatcher import trigger_immediate_alert
from services.anomaly import OutbreakDetector
from services.classifier import (
    classify_reporting_group,
    get_disease_name,
    validate_icd10,
)

logger = logging.getLogger("epilink.report_router")
detector = OutbreakDetector()

router = APIRouter(prefix="/api/v1", tags=["report"])


@router.post("/report", status_code=201)
async def submit_report(
    report_data: ReportSchema,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("epi_officer", "admin")),
):
    if not await validate_icd10(db, report_data.icd10_code):
        return JSONResponse(
            status_code=400,
            content={"error": f"ICD-10 code {report_data.icd10_code} not found in disease registry", "code": "INVALID_ICD10"},
        )

    reporting_group = classify_reporting_group(report_data.icd10_code)
    disease_name = await get_disease_name(db, report_data.icd10_code)
    hashed_physician = hash_physician_id(report_data.physician_id)

    submitted_at = datetime.now(timezone.utc)
    epi_week = submitted_at.isocalendar()[1]
    report_id = uuid.uuid4()

    report = CaseReport(
        id=uuid.uuid4(),
        report_id=report_id,
        submitted_at=submitted_at,
        epi_week=epi_week,
        facility_id=report_data.facility_id,
        physician_id=hashed_physician,
        governorate=report_data.governorate,
        district=report_data.district,
        age_group=report_data.age_group,
        sex=report_data.sex,
        nationality=report_data.nationality,
        icd10_code=report_data.icd10_code,
        disease_name=disease_name,
        reporting_group=reporting_group,
        symptom_onset_date=report_data.symptom_onset_date,
        diagnosis_basis=report_data.diagnosis_basis,
        hospitalized=report_data.hospitalized,
        outcome=report_data.outcome,
        lab_sample_taken=report_data.lab_sample_taken,
        submission_mode=report_data.submission_mode,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    alert_triggered = reporting_group == "A"
    message = "Group A disease — immediate alert dispatched" if reporting_group == "A" else "Report received successfully"

    if reporting_group == "A":
        asyncio.create_task(process_group_a_alert(report))

    asyncio.create_task(process_anomaly_check(report))

    return ReportResponse(
        status="received",
        report_id=str(report_id),
        reporting_group=reporting_group,
        alert_triggered=alert_triggered,
        message=message,
    )


async def process_group_a_alert(report: CaseReport):
    try:
        async with core_db.async_session_factory() as session:
            alert_level, z_score, confidence = await detector.check_cluster(
                session, report.governorate, report.icd10_code
            )
            await trigger_immediate_alert(session, report, alert_level, z_score, confidence)
    except Exception as e:
        logger.exception(f"Group A alert processing failed: {e}")


async def process_anomaly_check(report: CaseReport):
    try:
        async with core_db.async_session_factory() as session:
            await detector.check_cluster(session, report.governorate, report.icd10_code)
    except Exception as e:
        logger.exception(f"Anomaly check failed: {e}")