import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_report_id: uuid.UUID
    icd10_code: str
    governorate: str
    alert_level: str
    z_score: Optional[float] = None
    confidence: Optional[float] = None
    status: str
    dispatched_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    reviewer_decision: Optional[str] = None
    fhir_exported: bool
    created_at: datetime


class AlertReviewSchema(BaseModel):
    decision: str  # APPROVED, REJECTED, MORE_DATA


class DashboardOut(BaseModel):
    total_reports_this_week: int
    active_group_a_alerts: int
    alert_rate: float
    mean_confidence: float
    reports_by_governorate: list[dict]
    recent_alerts: list[AlertOut]
