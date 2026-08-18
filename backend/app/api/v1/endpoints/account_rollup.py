from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_account_scope
from app.core.db import get_db
from app.schemas.account_rollup import AccountRollupResponse, PullRollupItemRequest
from app.schemas.enums import RoleCode
from app.schemas.regional_status import AccountStatusItemRead
from app.services import account_rollup as account_rollup_service

router = APIRouter(prefix="/accounts/{account_id}/rollup", tags=["Account Reporting"])

_account_manager_write = [Depends(require_account_scope(RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN))]


@router.get("", response_model=AccountRollupResponse)
async def get_account_rollup(account_id: UUID, period_id: UUID, db: AsyncSession = Depends(get_db)):
    return await account_rollup_service.compute_account_rollup(db, account_id, period_id)


@router.post(
    "/pull", response_model=AccountStatusItemRead, status_code=status.HTTP_201_CREATED, dependencies=_account_manager_write
)
async def pull_account_rollup_item(
    account_id: UUID,
    payload: PullRollupItemRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await account_rollup_service.pull_rollup_item(db, account_id, payload.project_item_id)
    except account_rollup_service.RollupItemNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Status item not found for this account") from exc
    except account_rollup_service.RollupItemAlreadyHandledError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "This item has already been pulled or ignored") from exc
