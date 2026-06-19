import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import hash_physician_id
from models.case_report import CaseReport
from schemas.input import (
    TextInputRequest,
    FormInputRequest,
    ImageInputRequest,
    OCRTextInputRequest,
    InputResponse,
    HealthResponse,
)
from services.ocr import ocr_service
from services.translation import translation_service
from services.ai_parser import ai_parser_service
from services.classifier import (
    classify_reporting_group,
    get_disease_name,
    validate_icd10,
)
from services.alert_dispatcher import trigger_immediate_alert
from services.anomaly import OutbreakDetector

logger = logging.getLogger("epilink.input_router")
detector = OutbreakDetector()

router = APIRouter(prefix="/api/input", tags=["input"])


async def _save_report_and_process(
    db: AsyncSession,
    structured_data,
    reporting_group: str,
    disease_name: str,
    submission_mode: str,
) -> tuple[str, bool, str]:
    hashed_physician = hash_physician_id(structured_data.physician_id or "unknown")
    submitted_at = datetime.now(timezone.utc)
    epi_week = submitted_at.isocalendar()[1]
    report_id = uuid.uuid4()

    report = CaseReport(
        id=uuid.uuid4(),
        report_id=report_id,
        submitted_at=submitted_at,
        epi_week=epi_week,
        facility_id=structured_data.facility_id or "UNKNOWN",
        physician_id=hashed_physician,
        governorate=structured_data.governorate or "UNKNOWN",
        district=structured_data.district,
        age_group=structured_data.age_group or "60+",
        sex=structured_data.sex or "Male",
        nationality=structured_data.nationality or "Egyptian",
        icd10_code=structured_data.icd10_code,
        disease_name=disease_name,
        reporting_group=reporting_group,
        symptom_onset_date=structured_data.symptom_onset_date,
        diagnosis_basis=structured_data.diagnosis_basis or "Clinical",
        hospitalized=structured_data.hospitalized or False,
        outcome=structured_data.outcome or "Unknown",
        lab_sample_taken=structured_data.lab_sample_taken or False,
        submission_mode=submission_mode,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    alert_triggered = reporting_group == "A"
    message = "Group A disease — immediate alert dispatched" if reporting_group == "A" else "Report received successfully"

    if reporting_group == "A":
        asyncio.create_task(_process_group_a_alert(report))

    asyncio.create_task(_process_anomaly_check(report))

    return str(report_id), alert_triggered, message


async def _process_group_a_alert(report: CaseReport):
    try:
        from core import database as core_db
        async with core_db.async_session_factory() as session:
            alert_level, z_score, confidence = await detector.check_cluster(
                session, report.governorate, report.icd10_code
            )
            await trigger_immediate_alert(session, report, alert_level, z_score, confidence)
    except Exception as e:
        logger.exception(f"Group A alert processing failed: {e}")


async def _process_anomaly_check(report: CaseReport):
    try:
        from core import database as core_db
        async with core_db.async_session_factory() as session:
            await detector.check_cluster(session, report.governorate, report.icd10_code)
    except Exception as e:
        logger.exception(f"Anomaly check failed: {e}")


@router.post("/text", response_model=InputResponse)
async def process_text_input(request: TextInputRequest, db: AsyncSession = Depends(get_db)):
    try:
        detected_lang = await translation_service.detect_language(request.text)
        translations = await translation_service.translate_both(request.text, detected_lang)
        english_text = translations["english"]

        structured, warnings, confidence = await ai_parser_service.parse_text(
            english_text, translations, db
        )

        if not structured.icd10_code:
            return InputResponse(
                success=False,
                structured_data=structured,
                message="Could not determine disease from text. Please provide a valid ICD-10 code or more specific clinical details.",
                warnings=warnings,
                requires_human_review=True,
                confidence_score=confidence,
            )

        disease_name = await get_disease_name(db, structured.icd10_code)
        reporting_group = classify_reporting_group(structured.icd10_code)

        report_id, alert_triggered, message = await _save_report_and_process(
            db, structured, reporting_group, disease_name, "text-extracted"
        )

        return InputResponse(
            success=True,
            structured_data=structured,
            report_id=report_id,
            reporting_group=reporting_group,
            alert_triggered=alert_triggered,
            message=message,
            warnings=warnings,
            requires_human_review=confidence < 0.75 or len(warnings) > 0,
            confidence_score=confidence,
        )

    except Exception as e:
        logger.error(f"Text input processing failed: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": f"Processing failed: {str(e)}",
                "confidence_score": 0.0,
            }
        )


@router.post("/form", response_model=InputResponse)
async def process_form_input(request: FormInputRequest, db: AsyncSession = Depends(get_db)):
    try:
        if not await validate_icd10(db, request.icd10_code):
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "message": f"ICD-10 code {request.icd10_code} not found in disease registry",
                    "code": "INVALID_ICD10",
                }
            )

        from schemas.input import StructuredReportData
        structured = StructuredReportData(
            facility_id=request.facility_id,
            physician_id=request.physician_id,
            governorate=request.governorate,
            district=request.district,
            age_group=request.age_group,
            sex=request.sex,
            nationality=request.nationality,
            icd10_code=request.icd10_code,
            symptom_onset_date=request.symptom_onset_date,
            diagnosis_basis=request.diagnosis_basis,
            hospitalized=request.hospitalized,
            outcome=request.outcome,
            lab_sample_taken=request.lab_sample_taken,
            submission_mode=request.submission_mode,
        )

        disease_name = await get_disease_name(db, request.icd10_code)
        reporting_group = classify_reporting_group(request.icd10_code)

        report_id, alert_triggered, message = await _save_report_and_process(
            db, structured, reporting_group, disease_name, request.submission_mode
        )

        return InputResponse(
            success=True,
            structured_data=structured,
            report_id=report_id,
            reporting_group=reporting_group,
            alert_triggered=alert_triggered,
            message=message,
            warnings=[],
            requires_human_review=False,
            confidence_score=1.0,
        )

    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": str(e), "code": "VALIDATION_ERROR"}
        )
    except Exception as e:
        logger.error(f"Form input processing failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Processing failed: {str(e)}"}
        )


@router.post("/image", response_model=InputResponse)
async def process_image_input(request: ImageInputRequest, db: AsyncSession = Depends(get_db)):
    try:
        ocr_text, ocr_confidence = await ocr_service.extract_text_from_base64(
            request.image_base64, request.image_format
        )

        if not ocr_text:
            return InputResponse(
                success=False,
                message="No text could be extracted from the image. Please ensure the image is clear and contains readable text.",
                confidence_score=0.0,
                requires_human_review=True,
            )

        detected_lang = await translation_service.detect_language(ocr_text)
        translations = await translation_service.translate_both(ocr_text, detected_lang)
        english_text = translations["english"]

        structured, warnings, ai_confidence = await ai_parser_service.parse_text(
            english_text, translations, db
        )

        overall_confidence = (ocr_confidence + ai_confidence) / 2

        if not structured.icd10_code:
            warnings.append({
                "field": "image",
                "message": "Could not determine disease from image text. Please verify manually.",
                "confidence": ocr_confidence
            })
            return InputResponse(
                success=False,
                structured_data=structured,
                message="Disease not identifiable from image. Manual entry required.",
                warnings=warnings,
                requires_human_review=True,
                confidence_score=overall_confidence,
            )

        disease_name = await get_disease_name(db, structured.icd10_code)
        reporting_group = classify_reporting_group(structured.icd10_code)

        report_id, alert_triggered, message = await _save_report_and_process(
            db, structured, reporting_group, disease_name, "image-extracted"
        )

        return InputResponse(
            success=True,
            structured_data=structured,
            report_id=report_id,
            reporting_group=reporting_group,
            alert_triggered=alert_triggered,
            message=message,
            warnings=warnings,
            requires_human_review=overall_confidence < 0.75 or len(warnings) > 0,
            confidence_score=overall_confidence,
        )

    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": str(e), "code": "INVALID_IMAGE"}
        )
    except Exception as e:
        logger.error(f"Image input processing failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Processing failed: {str(e)}"}
        )


@router.post("/ocr-text", response_model=InputResponse)
async def process_ocr_text_input(request: OCRTextInputRequest, db: AsyncSession = Depends(get_db)):
    try:
        source_lang = request.source_language or await translation_service.detect_language(request.text)
        translations = await translation_service.translate_both(request.text, source_lang)
        english_text = translations["english"]

        structured, warnings, confidence = await ai_parser_service.parse_text(
            english_text, translations, db
        )

        if not structured.icd10_code:
            return InputResponse(
                success=False,
                structured_data=structured,
                message="Could not determine disease from OCR text. Please provide more details or use structured form.",
                warnings=warnings,
                requires_human_review=True,
                confidence_score=confidence,
            )

        disease_name = await get_disease_name(db, structured.icd10_code)
        reporting_group = classify_reporting_group(structured.icd10_code)

        report_id, alert_triggered, message = await _save_report_and_process(
            db, structured, reporting_group, disease_name, "text-extracted"
        )

        return InputResponse(
            success=True,
            structured_data=structured,
            report_id=report_id,
            reporting_group=reporting_group,
            alert_triggered=alert_triggered,
            message=message,
            warnings=warnings,
            requires_human_review=confidence < 0.75 or len(warnings) > 0,
            confidence_score=confidence,
        )

    except Exception as e:
        logger.error(f"OCR text processing failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Processing failed: {str(e)}"}
        )


@router.get("/health", response_model=HealthResponse)
async def health_check():
    db_status = "connected"
    try:
        from core.database import async_session_factory
        from sqlalchemy import select, func
        async with async_session_factory() as db:
            await db.execute(select(func.now()))
    except Exception:
        db_status = "disconnected"

    return HealthResponse(
        status="ok",
        version="1.0.0",
        database=db_status,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )