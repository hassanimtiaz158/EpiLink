import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import require_role
from models.alert import Alert
from models.user import User
from schemas.alert import AlertOut, AlertReviewSchema, ReviewResponse, AlertListResponse
from services.alert_dispatcher import dispatch_alert_record

logger = logging.getLogger("epilink.alert_router")

router = APIRouter(prefix="/api/v1", tags=["alert"])


@router.get("/alerts", response_model=AlertListResponse)
async def list_alerts(
    governorate: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    icd10_code: Optional[str] = Query(None),
    alert_level: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("viewer", "epi_officer", "admin")),
):
    stmt = select(Alert)
    count_stmt = select(func.count(Alert.id))

    if governorate:
        stmt = stmt.where(Alert.governorate == governorate)
        count_stmt = count_stmt.where(Alert.governorate == governorate)
    if status:
        stmt = stmt.where(Alert.status == status)
        count_stmt = count_stmt.where(Alert.status == status)
    if icd10_code:
        stmt = stmt.where(Alert.icd10_code == icd10_code)
        count_stmt = count_stmt.where(Alert.icd10_code == icd10_code)
    if alert_level:
        stmt = stmt.where(Alert.alert_level == alert_level)
        count_stmt = count_stmt.where(Alert.alert_level == alert_level)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    stmt = stmt.order_by(Alert.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    alerts = result.scalars().all()

    return AlertListResponse(
        total=total,
        alerts=[AlertOut.model_validate(a) for a in alerts],
    )


@router.get("/alerts/{alert_id}", response_model=AlertOut)
async def get_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("viewer", "epi_officer", "admin")),
):
    try:
        alert_uuid = UUID(alert_id)
    except ValueError:
        return JSONResponse(
            status_code=404,
            content={"error": "Alert not found", "code": "ALERT_NOT_FOUND"},
        )

    result = await db.execute(select(Alert).where(Alert.id == alert_uuid))
    alert = result.scalar_one_or_none()

    if alert is None:
        return JSONResponse(
            status_code=404,
            content={"error": "Alert not found", "code": "ALERT_NOT_FOUND"},
        )

    return AlertOut.model_validate(alert)


@router.patch("/alerts/{alert_id}/review", response_model=ReviewResponse)
async def review_alert(
    alert_id: str,
    review_data: AlertReviewSchema,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("epi_officer", "admin")),
):
    try:
        alert_uuid = UUID(alert_id)
    except ValueError:
        return JSONResponse(
            status_code=404,
            content={"error": "Alert not found", "code": "ALERT_NOT_FOUND"},
        )

    result = await db.execute(select(Alert).where(Alert.id == alert_uuid))
    alert = result.scalar_one_or_none()

    if alert is None:
        return JSONResponse(
            status_code=404,
            content={"error": "Alert not found", "code": "ALERT_NOT_FOUND"},
        )

    reviewed_at = datetime.now(timezone.utc)
    original_status = alert.status
    alert.status = review_data.decision
    alert.reviewed_at = reviewed_at
    alert.review_decision = review_data.decision
    alert.reviewed_by = review_data.reviewed_by
    alert.review_notes = review_data.notes
    await db.commit()
    await db.refresh(alert)

    # If confirmed and not already dispatched, dispatch now
    if review_data.decision == "confirmed" and original_status != "dispatched":
        await dispatch_alert_record(alert)

    return ReviewResponse(
        alert_id=str(alert.id),
        status=alert.status,
        reviewed_at=reviewed_at.isoformat(),
    )