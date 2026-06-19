from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, Field
from uuid import UUID


class Disease(BaseModel):
    id: str
    name: str
    icd10: Optional[str] = None


class TextInputRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Raw free-text or SMS-style input")
    source: Literal["manual", "sms", "import"] = "manual"
    facility_id: Optional[str] = None
    physician_id: Optional[str] = None


class FormInputRequest(BaseModel):
    facility_id: str
    physician_id: str
    governorate: str
    district: str
    age_group: Literal["<1", "1-4", "5-14", "15-29", "30-59", "60+"]
    sex: Literal["Male", "Female"]
    nationality: str = "Egyptian"
    icd10_code: str
    symptom_onset_date: date
    diagnosis_basis: Literal["Clinical", "Lab-confirmed", "Epidemiological link"]
    hospitalized: bool
    outcome: Literal["Alive", "Dead", "Unknown"]
    lab_sample_taken: bool
    submission_mode: Literal["online", "offline-cached", "sms-fallback"] = "online"


class ImageInputRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")
    image_format: Literal["jpeg", "png", "pdf"] = "jpeg"
    facility_id: Optional[str] = None
    physician_id: Optional[str] = None
    auto_submit: bool = False


class OCRTextInputRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="OCR-extracted text from frontend")
    source_language: Optional[str] = Field(None, description="Source language code (e.g., 'ar', 'en')")
    facility_id: Optional[str] = None
    physician_id: Optional[str] = None


class StructuredReportData(BaseModel):
    facility_id: Optional[str] = None
    physician_id: Optional[str] = None
    governorate: Optional[str] = None
    district: Optional[str] = None
    age_group: Optional[Literal["<1", "1-4", "5-14", "15-29", "30-59", "60+"]] = None
    sex: Optional[Literal["Male", "Female"]] = None
    nationality: Optional[str] = None
    icd10_code: Optional[str] = None
    symptom_onset_date: Optional[date] = None
    diagnosis_basis: Optional[Literal["Clinical", "Lab-confirmed", "Epidemiological link"]] = None
    hospitalized: Optional[bool] = None
    outcome: Optional[Literal["Alive", "Dead", "Unknown"]] = None
    lab_sample_taken: Optional[bool] = None
    submission_mode: Literal["online", "offline-cached", "sms-fallback", "text-extracted", "image-extracted"] = "online"


class ExtractionWarning(BaseModel):
    field: str
    message: str
    confidence: float = 0.0


class InputResponse(BaseModel):
    success: bool
    structured_data: Optional[StructuredReportData] = None
    report_id: Optional[str] = None
    reporting_group: Optional[str] = None
    alert_triggered: bool = False
    message: str
    warnings: list[ExtractionWarning] = []
    requires_human_review: bool = False
    confidence_score: float = 0.0


class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    timestamp: str