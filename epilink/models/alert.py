import datetime
import uuid
from sqlalchemy import String, Boolean, DateTime, Integer, Numeric, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func

from core.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    case_report_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("case_reports.id"), nullable=False
    )
    icd10_code: Mapped[str] = mapped_column(String(20), nullable=False)
    governorate: Mapped[str] = mapped_column(String(100), nullable=False)
    alert_level: Mapped[str] = mapped_column(String(20), nullable=False)
    z_score: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="PENDING_HUMAN_REVIEW")
    dispatched_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewer_decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fhir_exported: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
