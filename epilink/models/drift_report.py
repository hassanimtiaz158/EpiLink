import datetime
import uuid
from sqlalchemy import String, Float, Date, Boolean, DateTime, Integer, Text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func

from core.database import Base


class DriftReport(Base):
    __tablename__ = "drift_metrics"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    audit_run_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    week_start: Mapped[datetime.date] = mapped_column(Date(), nullable=False)
    week_end: Mapped[datetime.date] = mapped_column(Date(), nullable=False)
    total_reports: Mapped[int] = mapped_column(Integer(), nullable=False)
    total_alerts: Mapped[int] = mapped_column(Integer(), nullable=False)
    alert_rate: Mapped[float] = mapped_column(Float(), nullable=False)
    alert_rate_status: Mapped[str] = mapped_column(String(20), nullable=False)
    mean_confidence: Mapped[float | None] = mapped_column(Float(), nullable=True)
    human_confirmation_rate: Mapped[float | None] = mapped_column(Float(), nullable=True)
    baseline_recalibrated: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default="false")
    drift_detected: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default="false")
    admin_notified: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default="false")
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)

    __table_args__ = (
        CheckConstraint("alert_rate_status IN ('NORMAL', 'DRIFT_DETECTED')", name="ck_drift_status"),
    )