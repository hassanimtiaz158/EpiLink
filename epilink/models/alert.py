import datetime
import uuid
from sqlalchemy import String, DateTime, Float, ForeignKey, CheckConstraint, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func

from core.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("case_reports.id"), nullable=False
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    icd10_code: Mapped[str] = mapped_column(String(10), nullable=False)
    governorate: Mapped[str] = mapped_column(String(100), nullable=False)
    alert_level: Mapped[str] = mapped_column(String(20), nullable=False)
    z_score: Mapped[float | None] = mapped_column(Float(), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float(), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending"
    )
    dispatched_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    dispatch_targets: Mapped[dict | None] = mapped_column(JSON(), nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reviewed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    review_decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text(), nullable=True)

    __table_args__ = (
        CheckConstraint("alert_level IN ('HIGH', 'REVIEW', 'NORMAL')", name="ck_alerts_level"),
        CheckConstraint("status IN ('pending', 'dispatched', 'under_review', 'confirmed', 'dismissed')", name="ck_alerts_status"),
        CheckConstraint("review_decision IN ('confirmed', 'dismissed')", name="ck_alerts_review"),
    )