import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.alert import Alert
from schemas.alert import AlertOut, AlertReviewSchema

logger = logging.getLogger("epilink.alert_router")

router = APIRouter(prefix="/api/v1", tags=["alert"])


@router.get("/alerts", response_model=list[AlertOut])
async def list_alerts(
    governorate: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    icd10_code: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Alert)

    if governorate:
        stmt = stmt.where(Alert.governorate == governorate)
    if status:
        stmt = stmt.where(Alert.status == status)
    if icd10_code:
        stmt = stmt.where(Alert.icd10_code == icd10_code)

    stmt = stmt.order_by(Alert.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    alerts = result.scalars().all()
    return alerts


@router.patch("/alerts/{alert_id}/review", response_model=AlertOut)
async def review_alert(
    alert_id: str,
    review_data: AlertReviewSchema,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()

    if alert is None:
        raise HTTPException(
            status_code=404,
            detail={"error": f"Alert {alert_id} not found", "code": "NOT_FOUND"},
        )

    alert.status = review_data.decision
    alert.reviewed_at = datetime.now(timezone.utc)
    alert.reviewer_decision = review_data.decision
    await db.commit()
    await db.refresh(alert)

    return alert
