import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func

from core.database import Base


class DiseaseRegistry(Base):
    __tablename__ = "disease_registry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    icd10_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name_en: Mapped[str] = mapped_column(String(200), nullable=False)
    name_ar: Mapped[str] = mapped_column(String(200), nullable=False)
    reporting_group: Mapped[str] = mapped_column(String(1), nullable=False)
    alert_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("reporting_group IN ('A', 'B')", name="ck_reporting_group"),
    )
