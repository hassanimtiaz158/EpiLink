from pydantic import BaseModel


class AnalysisRequest(BaseModel):
    text: str
    source: str = "manual"


class AnalysisResponse(BaseModel):
    success: bool
    disease_name: str | None = None
    icd10_code: str | None = None
    confidence: float = 0.0
    severity: str = "low"
    alert_level: str = "NORMAL"
    governorate: str | None = None
    district: str | None = None
    age_group: str | None = None
    sex: str | None = None
    summary: str = ""
    recommendation: str = ""
    risk_factors: list[str] = []
    nearby_governorates: list[str] = []
    message: str = ""
