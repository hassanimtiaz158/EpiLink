from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.disease_registry import DiseaseRegistry


async def validate_icd10(db: AsyncSession, icd10_code: str) -> bool:
    result = await db.execute(
        select(DiseaseRegistry).where(DiseaseRegistry.icd10_code == icd10_code)
    )
    return result.scalar_one_or_none() is not None


async def classify_reporting_group(db: AsyncSession, icd10_code: str) -> str:
    result = await db.execute(
        select(DiseaseRegistry.reporting_group).where(
            DiseaseRegistry.icd10_code == icd10_code
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise ValueError(f"ICD-10 code {icd10_code} not found in disease registry")
    return row


async def get_alert_window_minutes(
    db: AsyncSession, icd10_code: str
) -> Optional[int]:
    result = await db.execute(
        select(DiseaseRegistry.alert_minutes).where(
            DiseaseRegistry.icd10_code == icd10_code
        )
    )
    return result.scalar_one_or_none()


async def is_immediate_alert(db: AsyncSession, icd10_code: str) -> bool:
    minutes = await get_alert_window_minutes(db, icd10_code)
    return minutes is not None and minutes == 60


async def get_disease_name(db: AsyncSession, icd10_code: str) -> str:
    result = await db.execute(
        select(DiseaseRegistry.name_en).where(
            DiseaseRegistry.icd10_code == icd10_code
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise ValueError(f"ICD-10 code {icd10_code} not found in disease registry")
    return row
