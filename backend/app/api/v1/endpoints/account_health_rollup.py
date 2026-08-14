from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.schemas.account_health_declarations import AccountHealthItemRead
from app.schemas.account_health_rollup import AccountHealthRollupResponse, PullHealthRollupItemRequest
from app.services import account_health_rollup as account_health_rollup_service

router = APIRouter(prefix="/accounts/{account_id}/health-rollup", tags=["Account Reporting"])


@router.get("", response_model=AccountHealthRollupResponse)
async def get_account_health_rollup(account_id: UUID, period_id: UUID, db: AsyncSession = Depends(get_db)):
    return await account_health_rollup_service.compute_account_health_rollup(db, account_id, period_id)


@router.post("/pull", response_model=AccountHealthItemRead, status_code=status.HTTP_201_CREATED)
async def pull_account_health_rollup_item(
    account_id: UUID,
    payload: PullHealthRollupItemRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await account_health_rollup_service.pull_health_rollup_item(db, account_id, payload.project_item_id)
    except account_health_rollup_service.RollupItemNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Health item not found for this account") from exc
    except account_health_rollup_service.RollupItemAlreadyHandledError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "This item has already been pulled or ignored") from exc
