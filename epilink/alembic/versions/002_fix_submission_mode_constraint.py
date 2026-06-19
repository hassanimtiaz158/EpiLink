"""Update submission_mode check constraint

Revision ID: 002
Revises: 001
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE case_reports DROP CONSTRAINT IF EXISTS ck_reports_submission_mode"
    )
    op.create_check_constraint(
        "ck_reports_submission_mode",
        "case_reports",
        "submission_mode IN ('online', 'sms', 'whatsapp', 'api', 'text-extracted', 'image-extracted')",
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE case_reports DROP CONSTRAINT IF EXISTS ck_reports_submission_mode"
    )
    op.create_check_constraint(
        "ck_reports_submission_mode",
        "case_reports",
        "submission_mode IN ('online', 'sms', 'whatsapp', 'api')",
    )
