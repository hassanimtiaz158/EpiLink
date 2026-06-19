import logging
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.disease_registry import DiseaseRegistry
from schemas.input import Disease

logger = logging.getLogger("epilink.reference_router")

router = APIRouter(prefix="/api/v1", tags=["reference"])


@router.get("/reference/diseases", response_model=List[Disease])
async def list_diseases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DiseaseRegistry).order_by(DiseaseRegistry.name))
    diseases = result.scalars().all()
    return [
        Disease(id=str(d.id), name=d.name, icd10=d.icd10_code)
        for d in diseases
    ]