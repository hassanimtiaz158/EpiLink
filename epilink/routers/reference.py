from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.disease_registry import DiseaseRegistry
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
