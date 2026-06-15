import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_report_id: uuid.UUID
    icd10_code: str
    governorate: str
    alert_level: str
    z_score: Optional[float] = None
    confidence: Optional[float] = None
    status: str
    dispatched_at: Optional[datetime] = None
    dispatch_targets: Optional[dict] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_decision: Optional[str] = None
    review_notes: Optional[str] = None
    created_at: datetime


class AlertReviewSchema(BaseModel):
    decision: str  # confirmed, dismissed
    reviewed_by: str = ""
    notes: str = ""


class ReviewResponse(BaseModel):
    alert_id: str
    status: str
    reviewed_at: str


class AlertListResponse(BaseModel):
    total: int
    alerts: list[AlertOut]


class WeeklyTrendItem(BaseModel):
    epi_week: int
    week_start: str
    total_reports: int
    group_a_reports: int
    group_b_reports: int
    alerts_dispatched: int


class TopDiseaseItem(BaseModel):
    disease: str
    icd10: str
    count: int


class DashboardSummary(BaseModel):
    total_reports_this_week: int
    total_alerts_this_week: int
    alert_rate: float
    alert_rate_status: str
    pending_reviews: int


class DashboardDrift(BaseModel):
    last_audit: Optional[str] = None
    mean_confidence: float = 0.0
    human_confirmation_rate: float = 0.0
    status: str = "NORMAL"


class DashboardOut(BaseModel):
    summary: DashboardSummary
    weekly_trend: list[WeeklyTrendItem] = []
    top_diseases: list[TopDiseaseItem] = []
    recent_alerts: list[AlertOut] = []
    drift: DashboardDrift
