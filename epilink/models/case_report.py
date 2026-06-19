import datetime
import uuid
from sqlalchemy import String, Boolean, DateTime, Date, ForeignKey, CheckConstraint, SmallInteger, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func

from core.database import Base


class CaseReport(Base):
    __tablename__ = "case_reports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(unique=True, nullable=False, default=uuid.uuid4)
    submitted_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    epi_week: Mapped[int] = mapped_column(SmallInteger(), nullable=False)
    submission_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="online"
    )
    sync_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="synced"
    )
    facility_id: Mapped[str] = mapped_column(String(50), nullable=False)
    governorate: Mapped[str] = mapped_column(String(100), nullable=False)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    physician_id: Mapped[str] = mapped_column(String(64), nullable=False)
    icd10_code: Mapped[str] = mapped_column(
        String(10), ForeignKey("diseases.icd10_code"), nullable=False
    )
    disease_name: Mapped[str] = mapped_column(String(200), nullable=False)
    reporting_group: Mapped[str] = mapped_column(String(1), nullable=False)
    symptom_onset_date: Mapped[datetime.date | None] = mapped_column(Date(), nullable=True)
    diagnosis_basis: Mapped[str | None] = mapped_column(String(30), nullable=True)
    age_group: Mapped[str] = mapped_column(String(10), nullable=False)
    sex: Mapped[str] = mapped_column(String(10), nullable=False)
    nationality: Mapped[str | None] = mapped_column(String(20), nullable=True)
    hospitalized: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default="false")
    outcome: Mapped[str] = mapped_column(String(20), nullable=False, server_default="Unknown")
    lab_sample_taken: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default="false")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("sex IN ('Male', 'Female')", name="ck_reports_sex"),
        CheckConstraint("reporting_group IN ('A', 'B')", name="ck_reports_group"),
        CheckConstraint("age_group IN ('<1', '1-4', '5-14', '15-29', '30-59', '60+')", name="ck_reports_age_group"),
        CheckConstraint("outcome IN ('Alive', 'Dead', 'Unknown')", name="ck_reports_outcome"),
        CheckConstraint("diagnosis_basis IN ('Clinical', 'Lab-confirmed', 'Epidemiological link')", name="ck_reports_diagnosis_basis"),
        CheckConstraint("submission_mode IN ('online', 'offline-cached', 'sms-fallback', 'text-extracted', 'image-extracted')", name="ck_reports_submission_mode"),
        CheckConstraint("sync_status IN ('synced', 'pending', 'failed')", name="ck_reports_sync_status"),
        CheckConstraint("nationality IN ('Egyptian', 'Other')", name="ck_reports_nationality_nationality"),
    )