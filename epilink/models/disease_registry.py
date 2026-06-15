import datetime
import uuid
from sqlalchemy import String, Boolean, DateTime, Text, CheckConstraint, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func

from core.database import Base


class DiseaseRegistry(Base):
    __tablename__ = "diseases"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    icd10_code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    group_label: Mapped[str] = mapped_column(String(1), nullable=False)
    alert_minutes: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("group_label IN ('A', 'B')", name="ck_diseases_group_label"),
    )