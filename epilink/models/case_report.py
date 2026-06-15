import datetime
import uuid
from sqlalchemy import String, Boolean, DateTime, Integer, Date, ForeignKey, CheckConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func

from core.database import Base


class CaseReport(Base):
    __tablename__ = "case_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, unique=True, nullable=False
    )
    submitted_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    facility_id: Mapped[str] = mapped_column(String(50), nullable=False)
    physician_id: Mapped[str] = mapped_column(String(64), nullable=False)
    governorate: Mapped[str] = mapped_column(String(100), nullable=False)
    district: Mapped[str] = mapped_column(String(100), nullable=False)
    age_group: Mapped[str] = mapped_column(String(20), nullable=False)
    sex: Mapped[str] = mapped_column(String(1), nullable=False)
    nationality: Mapped[str] = mapped_column(String(50), default="Egyptian")
    icd10_code: Mapped[str] = mapped_column(
        String(20), ForeignKey("disease_registry.icd10_code"), nullable=False
    )
    disease_name: Mapped[str] = mapped_column(String(200), nullable=False)
    reporting_group: Mapped[str] = mapped_column(String(1), nullable=False)
    symptom_onset_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    diagnosis_basis: Mapped[str] = mapped_column(String(30), nullable=False)
    hospitalized: Mapped[bool] = mapped_column(Boolean, nullable=False)
    outcome: Mapped[str] = mapped_column(String(20), nullable=False)
    lab_sample_taken: Mapped[bool] = mapped_column(Boolean, nullable=False)
    submission_mode: Mapped[str] = mapped_column(String(20), default="online")
    sync_status: Mapped[str] = mapped_column(String(20), default="synced")
    epi_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("sex IN ('M', 'F')", name="ck_sex"),
        CheckConstraint("reporting_group IN ('A', 'B')", name="ck_reporting_group"),
    )
