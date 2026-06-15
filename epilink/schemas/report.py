from datetime import date
from typing import Literal

from pydantic import BaseModel


class ReportSchema(BaseModel):
    facility_id: str
    physician_id: str
    governorate: str
    district: str
    age_group: Literal["<1", "1-4", "5-14", "15-29", "30-59", "60+"]
    sex: Literal["M", "F"]
    nationality: str = "Egyptian"
    icd10_code: str
    symptom_onset_date: date
    diagnosis_basis: Literal["Clinical", "Lab-confirmed", "Epidemiological link"]
    hospitalized: bool
    outcome: Literal["Alive", "Dead", "Unknown"]
    lab_sample_taken: bool
    submission_mode: Literal["online", "offline-cached", "sms-fallback"] = "online"


class ReportResponse(BaseModel):
    status: str
    report_id: str
    reporting_group: str
