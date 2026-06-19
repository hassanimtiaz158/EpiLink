import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.groq_analyzer import groq_analyzer
from services.translation import translation_service
from services.classifier import classify_reporting_group
from schemas.analysis import AnalysisRequest, AnalysisResponse

logger = logging.getLogger("epilink.analysis_router")

router = APIRouter(prefix="/api/v1", tags=["analysis"])


@router.post("/analysis/analyze", response_model=AnalysisResponse)
async def analyze_report(request: AnalysisRequest, db: AsyncSession = Depends(get_db)):
    try:
        detected_lang = await translation_service.detect_language(request.text)
        translations = await translation_service.translate_both(request.text, detected_lang)
        english_text = translations["english"]

        result = await groq_analyzer.analyze_text(english_text)

        if result.icd10_code:
            reporting_group = classify_reporting_group(result.icd10_code)
        else:
            reporting_group = None

        return AnalysisResponse(
            success=True,
            disease_name=result.disease_name,
            icd10_code=result.icd10_code,
            confidence=result.confidence,
            severity=result.severity,
            alert_level=result.alert_level,
            governorate=result.governorate,
            district=result.district,
            age_group=result.age_group,
            sex=result.sex,
            summary=result.summary,
            recommendation=result.recommendation,
            risk_factors=result.risk_factors,
            nearby_governorates=result.nearby_governorates,
            message=f"Analysis complete — {result.disease_name or 'Unknown disease'} ({result.alert_level})",
        )
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        return AnalysisResponse(
            success=False,
            message=f"Analysis failed: {str(e)}",
        )
