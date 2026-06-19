<<<<<<< HEAD
import logging
from typing import List
=======
>>>>>>> 67e0f965c0d324d8b9d3c8e6af0746f272eb1adc
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.disease_registry import DiseaseRegistry
<<<<<<< HEAD
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
=======
from schemas.reference import DiseaseOut

router = APIRouter(prefix="/api", tags=["reference"])


@router.get("/reference/diseases", response_model=list[DiseaseOut])
async def list_diseases(db: AsyncSession = Depends(get_db)):
    """List all diseases in the registry for reference data."""
    result = await db.execute(
        select(DiseaseRegistry).order_by(DiseaseRegistry.name)
    )
    diseases = result.scalars().all()
    return diseases
>>>>>>> 67e0f965c0d324d8b9d3c8e6af0746f272eb1adc
