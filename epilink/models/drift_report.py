import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, Numeric, Date
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func

from core.database import Base


class DriftReport(Base):
    __tablename__ = "drift_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    week_start: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    alert_rate: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    alert_rate_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    mean_confidence: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    human_confirmation_rate: Mapped[float | None] = mapped_column(
        Numeric(4, 3), nullable=True
    )
    drift_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    admin_notified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
