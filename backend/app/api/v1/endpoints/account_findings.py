"""Account Findings API — the Delivery Manager's view of DE findings raised on
their own accounts (primary or proxy assignment in user_accounts; ADMIN sees
all). Reads reuse the DE Account Audit list/KPI service with a
`restrict_account_ids` scope. The only write is "Action Taken": record what was
done (+ the date) and move the finding to "Awaiting Closure".
"""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, _owned_account_ids, _role_code, get_current_user, pagination_params, require_role
from app.core.db import get_db
from app.models.de_account_audit import DEAccountFinding
from app.models.reference_data import Account
from app.models.users import User
from app.schemas.common import Page
from app.schemas.de_account_audit import (
    AccountFindingActionTaken,
    DEAccountFindingHistoryRead,
    DEAccountFindingRead,
    DEAccountFindingRow,
    DEAccountFindingsKpis,
)
from app.schemas.enums import DEFindingHistoryEventType, FindingStatus, RoleCode
from app.services import notifications as notify_svc
from app.services.de_account_audit import (
    AccountFindingFilters,
    findings_kpis,
    list_findings,
    list_history,
    record_history,
)

router = APIRouter(prefix="/account-findings", tags=["Account Findings"])

_gate = [Depends(require_role(RoleCode.ACCOUNT_MANAGER, RoleCode.ADMIN))]
_ACTIONABLE = (FindingStatus.OPEN.value, FindingStatus.IN_PROGRESS.value)


async def _scope(user: User, db: AsyncSession) -> set[UUID] | None:
    """The caller's account ids, or None (= unrestricted) for ADMIN."""
    if await _role_code(db, user) == RoleCode.ADMIN:
        return None
    return await _owned_account_ids(db, user)


@router.get("", response_model=Page[DEAccountFindingRow], dependencies=_gate)
async def list_account_findings(
    account_id: UUID | None = None,
    geo_id: UUID | None = None,
    classification: str | None = None,
    status: str | None = "Active",
    search: str | None = None,
    bucket: str | None = None,
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = AccountFindingFilters(
        account_id=account_id,
        geo_id=geo_id,
        restrict_account_ids=await _scope(current_user, db),
        classification=classification,
        status=status,
        search=search,
        bucket=bucket,
    )
    items, total = await list_findings(db, filters, pagination.skip, pagination.limit)
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/kpis", response_model=DEAccountFindingsKpis, dependencies=_gate)
async def account_findings_kpis(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await findings_kpis(db, AccountFindingFilters(restrict_account_ids=await _scope(current_user, db)))


async def _owned_finding(db: AsyncSession, finding_id: UUID, user: User) -> DEAccountFinding:
    finding = await db.get(DEAccountFinding, finding_id)
    if finding is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Finding not found")
    scope = await _scope(user, db)
    if scope is not None and finding.account_id not in scope:
        raise HTTPException(http_status.HTTP_403_FORBIDDEN, "Not the Delivery Manager of this account")
    return finding


@router.get("/{finding_id}/history", response_model=list[DEAccountFindingHistoryRead], dependencies=_gate)
async def account_finding_history(
    finding_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _owned_finding(db, finding_id, current_user)
    return await list_history(db, finding_id)


@router.put("/{finding_id}/action-taken", response_model=DEAccountFindingRead, dependencies=_gate)
async def action_taken(
    finding_id: UUID,
    payload: AccountFindingActionTaken,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    finding = await _owned_finding(db, finding_id, current_user)
    if finding.status not in _ACTIONABLE:
        raise HTTPException(http_status.HTTP_409_CONFLICT, f"Finding is {finding.status}, not open for action")

    old_status = finding.status
    finding.action_taken = payload.action_taken
    finding.action_taken_date = payload.action_taken_date or date.today()
    finding.status = FindingStatus.AWAITING_CLOSURE.value
    await db.flush()
    await record_history(
        db,
        finding.id,
        DEFindingHistoryEventType.ACTION_TAKEN,
        current_user.id,
        old_value=old_status,
        new_value=finding.status,
        comment=payload.action_taken,
    )

    account = await db.get(Account, finding.account_id)
    if account is not None:
        await notify_svc.notify(
            db,
            recipient_id=account.delivery_excellence_id,
            type="FINDING_STATUS",
            title=f"Finding on account {account.name} is awaiting closure",
            body=payload.action_taken,
            link="/de-account-findings",
            entity_type="account_finding",
            entity_id=finding.id,
            actor_id=current_user.id,
            data={"account_name": account.name, "status": finding.status},
        )
    return finding

