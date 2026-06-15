"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "disease_registry",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("icd10_code", sa.String(20), nullable=False),
        sa.Column("name_en", sa.String(200), nullable=False),
        sa.Column("name_ar", sa.String(200), nullable=False),
        sa.Column("reporting_group", sa.String(1), nullable=False),
        sa.Column("alert_minutes", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("icd10_code"),
        sa.CheckConstraint("reporting_group IN ('A', 'B')", name="ck_reporting_group"),
    )

    op.create_table(
        "case_reports",
        sa.Column("id", sa.Uuid, nullable=False),
        sa.Column("report_id", sa.Uuid, nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("facility_id", sa.String(50), nullable=False),
        sa.Column("physician_id", sa.String(64), nullable=False),
        sa.Column("governorate", sa.String(100), nullable=False),
        sa.Column("district", sa.String(100), nullable=False),
        sa.Column("age_group", sa.String(20), nullable=False),
        sa.Column("sex", sa.String(1), nullable=False),
        sa.Column("nationality", sa.String(50), server_default=sa.text("'Egyptian'"), nullable=False),
        sa.Column("icd10_code", sa.String(20), nullable=False),
        sa.Column("disease_name", sa.String(200), nullable=False),
        sa.Column("reporting_group", sa.String(1), nullable=False),
        sa.Column("symptom_onset_date", sa.Date(), nullable=False),
        sa.Column("diagnosis_basis", sa.String(30), nullable=False),
        sa.Column("hospitalized", sa.Boolean(), nullable=False),
        sa.Column("outcome", sa.String(20), nullable=False),
        sa.Column("lab_sample_taken", sa.Boolean(), nullable=False),
        sa.Column("submission_mode", sa.String(20), server_default=sa.text("'online'"), nullable=False),
        sa.Column("sync_status", sa.String(20), server_default=sa.text("'synced'"), nullable=False),
        sa.Column("epi_week", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("report_id"),
        sa.ForeignKeyConstraint(["icd10_code"], ["disease_registry.icd10_code"],),
        sa.CheckConstraint("sex IN ('M', 'F')", name="ck_sex"),
        sa.CheckConstraint("reporting_group IN ('A', 'B')", name="ck_reporting_group"),
    )

    op.create_table(
        "alerts",
        sa.Column("id", sa.String(20), nullable=False),
        sa.Column("case_report_id", sa.Uuid, nullable=False),
        sa.Column("icd10_code", sa.String(20), nullable=False),
        sa.Column("governorate", sa.String(100), nullable=False),
        sa.Column("alert_level", sa.String(20), nullable=False),
        sa.Column("z_score", sa.Numeric(6, 3), nullable=True),
        sa.Column("confidence", sa.Numeric(4, 3), nullable=True),
        sa.Column("status", sa.String(30), server_default=sa.text("'PENDING_HUMAN_REVIEW'"), nullable=False),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewer_decision", sa.String(20), nullable=True),
        sa.Column("fhir_exported", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_report_id"], ["case_reports.id"],),
    )

    op.create_table(
        "drift_reports",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("alert_rate", sa.Numeric(6, 4), nullable=True),
        sa.Column("alert_rate_status", sa.String(20), nullable=True),
        sa.Column("mean_confidence", sa.Numeric(4, 3), nullable=True),
        sa.Column("human_confirmation_rate", sa.Numeric(4, 3), nullable=True),
        sa.Column("drift_detected", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("admin_notified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("drift_reports")
    op.drop_table("alerts")
    op.drop_table("case_reports")
    op.drop_table("disease_registry")
