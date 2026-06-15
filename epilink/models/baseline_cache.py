import datetime
import uuid
from sqlalchemy import String, Float, Integer, SmallInteger, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func

from core.database import Base


class BaselineCache(Base):
    __tablename__ = "baseline_cache"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    governorate: Mapped[str] = mapped_column(String(100), nullable=False)
    icd10_prefix: Mapped[str] = mapped_column(String(3), nullable=False)
    epi_week: Mapped[int] = mapped_column(SmallInteger(), nullable=False)
    baseline_mean: Mapped[float] = mapped_column(Float(), nullable=False)
    baseline_std: Mapped[float] = mapped_column(Float(), nullable=False)
    data_points: Mapped[int] = mapped_column(Integer(), nullable=False)
    computed_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("governorate", "icd10_prefix", "epi_week", name="uq_baseline_gov_icd_week"),
    )