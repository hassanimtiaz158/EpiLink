"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable PostGIS extension
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # 1. diseases table
    op.create_table(
        "diseases",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("icd10_code", sa.String(10), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("group_label", sa.String(1), nullable=False),
        sa.Column("alert_minutes", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("icd10_code"),
        sa.CheckConstraint("group_label IN ('A', 'B')", name="ck_diseases_group_label"),
    )
    op.create_index("idx_diseases_icd10", "diseases", ["icd10_code"])

    # 2. case_reports table
    op.create_table(
        "case_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("report_id", sa.Uuid(), nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column("epi_week", sa.SmallInteger(), nullable=False),
        sa.Column(
            "submission_mode",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'online'"),
        ),
        sa.Column(
            "sync_status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'synced'"),
        ),
        sa.Column("facility_id", sa.String(50), nullable=False),
        sa.Column("governorate", sa.String(100), nullable=False),
        sa.Column("district", sa.String(100), nullable=True),
        sa.Column("physician_id", sa.String(64), nullable=False),
        sa.Column("icd10_code", sa.String(10), nullable=False),
        sa.Column("disease_name", sa.String(200), nullable=False),
        sa.Column("reporting_group", sa.String(1), nullable=False),
        sa.Column("symptom_onset_date", sa.Date(), nullable=True),
        sa.Column("diagnosis_basis", sa.String(30), nullable=True),
        sa.Column("age_group", sa.String(10), nullable=False),
        sa.Column("sex", sa.String(10), nullable=False),
        sa.Column("nationality", sa.String(20), nullable=True),
        sa.Column("hospitalized", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("outcome", sa.String(20), nullable=False, server_default=sa.text("'Unknown'")),
        sa.Column("lab_sample_taken", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("report_id"),
        sa.ForeignKeyConstraint(["icd10_code"], ["diseases.icd10_code"]),
        sa.CheckConstraint("sex IN ('Male', 'Female')", name="ck_reports_sex"),
        sa.CheckConstraint("reporting_group IN ('A', 'B')", name="ck_reports_group"),
        sa.CheckConstraint("age_group IN ('<1', '1-4', '5-14', '15-29', '30-59', '60+')", name="ck_reports_age_group"),
        sa.CheckConstraint("outcome IN ('Alive', 'Dead', 'Unknown')", name="ck_reports_outcome"),
        sa.CheckConstraint("diagnosis_basis IN ('Clinical', 'Lab-confirmed', 'Epidemiological link')", name="ck_reports_diagnosis_basis"),
        sa.CheckConstraint("submission_mode IN ('online', 'offline-cached', 'sms-fallback')", name="ck_reports_submission_mode"),
        sa.CheckConstraint("sync_status IN ('synced', 'pending', 'failed')", name="ck_reports_sync_status"),
        sa.CheckConstraint("nationality IN ('Egyptian', 'Other')", name="ck_reports_nationality"),
    )
    op.create_index("idx_reports_icd10", "case_reports", ["icd10_code"])
    op.create_index("idx_reports_governorate", "case_reports", ["governorate"])
    op.create_index("idx_reports_submitted", "case_reports", ["submitted_at"])
    op.create_index("idx_reports_epi_week", "case_reports", ["epi_week"])
    op.create_index("idx_reports_group", "case_reports", ["reporting_group"])
    op.create_index("idx_reports_geo_disease", "case_reports", ["governorate", "icd10_code", "submitted_at"])

    # 3. alerts table
    op.create_table(
        "alerts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("case_report_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("icd10_code", sa.String(10), nullable=False),
        sa.Column("governorate", sa.String(100), nullable=False),
        sa.Column("alert_level", sa.String(20), nullable=False),
        sa.Column("z_score", sa.Float(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dispatch_targets", sa.JSON(), nullable=True),
        sa.Column("reviewed_by", sa.String(100), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_decision", sa.String(20), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_report_id"], ["case_reports.id"]),
        sa.CheckConstraint("alert_level IN ('HIGH', 'REVIEW', 'NORMAL')", name="ck_alerts_level"),
        sa.CheckConstraint("status IN ('pending', 'dispatched', 'under_review', 'confirmed', 'dismissed')", name="ck_alerts_status"),
        sa.CheckConstraint("review_decision IN ('confirmed', 'dismissed')", name="ck_alerts_review"),
    )
    op.create_index("idx_alerts_case_report", "alerts", ["case_report_id"])
    op.create_index("idx_alerts_status", "alerts", ["status"])
    op.create_index("idx_alerts_created", "alerts", ["created_at"])

    # 4. audit_log table
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("source", sa.String(30), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_audit_occurred", "audit_log", ["occurred_at"])
    op.create_index("idx_audit_event", "audit_log", ["event_type"])
    op.create_index("idx_audit_entity_id", "audit_log", ["entity_id"])

    # 5. drift_metrics table
    op.create_table(
        "drift_metrics",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "audit_run_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("week_end", sa.Date(), nullable=False),
        sa.Column("total_reports", sa.Integer(), nullable=False),
        sa.Column("total_alerts", sa.Integer(), nullable=False),
        sa.Column("alert_rate", sa.Float(), nullable=False),
        sa.Column("alert_rate_status", sa.String(20), nullable=False),
        sa.Column("mean_confidence", sa.Float(), nullable=True),
        sa.Column("human_confirmation_rate", sa.Float(), nullable=True),
        sa.Column("baseline_recalibrated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("drift_detected", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("admin_notified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("alert_rate_status IN ('NORMAL', 'DRIFT_DETECTED')", name="ck_drift_status"),
    )

    # 6. baseline_cache table
    op.create_table(
        "baseline_cache",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("governorate", sa.String(100), nullable=False),
        sa.Column("icd10_prefix", sa.String(3), nullable=False),
        sa.Column("epi_week", sa.SmallInteger(), nullable=False),
        sa.Column("baseline_mean", sa.Float(), nullable=False),
        sa.Column("baseline_std", sa.Float(), nullable=False),
        sa.Column("data_points", sa.Integer(), nullable=False),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("governorate", "icd10_prefix", "epi_week", name="uq_baseline_gov_icd_week"),
    )

    # Optional: facility_location column for case_reports (PostGIS)
    op.execute("""
        ALTER TABLE case_reports ADD COLUMN IF NOT EXISTS
        facility_location GEOMETRY(Point, 4326);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_reports_location
        ON case_reports USING GIST(facility_location);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_reports_location;")
    op.execute("ALTER TABLE case_reports DROP COLUMN IF EXISTS facility_location;")
    op.drop_table("baseline_cache")
    op.drop_table("drift_metrics")
    op.drop_table("audit_log")
    op.drop_table("alerts")
    op.drop_table("case_reports")
    op.drop_table("diseases")
    op.execute("DROP EXTENSION IF EXISTS postgis;")