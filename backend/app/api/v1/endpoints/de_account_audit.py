"""DE Account Audit — the account-level counterpart of DE Assessment + DE Findings.

A DE (or Admin) audits an account that has a Delivery Excellence auditor allocated
(accounts.delivery_excellence_id, set on DE Account Allocation) and raises/closes
findings against it. Like the project-level assessment this is independent of
reporting periods: any DELIVERY_EXCELLENCE user may audit any allocated account,
as often as needed and at least once per calendar month. Admin bypasses the
allocation check. The account's Delivery Manager responds on /account-findings.
"""

from datetime import UTC, date, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, _role_code, pagination_params, require_role
from app.core.db import get_db
from app.models.de_account_audit import DEAccountAudit, DEAccountFinding
from app.models.projects import Project
from app.models.reference_data import Account
from app.models.users import User
from app.schemas.common import Page
from app.schemas.de_account_audit import (
    DEAccountAuditCreate,
    DEAccountAuditRead,
    DEAccountAuditUpdate,
    DEAccountFindingCreate,
    DEAccountFindingHistoryRead,
    DEAccountFindingRead,
    DEAccountFindingRow,
    DEAccountFindingsKpis,
    DEAccountFindingUpdate,
    DEAccountQueue,
)
from app.schemas.enums import DEAssessmentStatus, DEFindingHistoryEventType, FindingStatus, RoleCode
from app.services import notifications as notify_svc
from app.services.assessment_window import check_assessment_window
from app.services.de_account_audit import (
    AccountFindingFilters,
    build_queue,
    findings_kpis,
    list_findings,
    list_history,
    next_sequence_no,
    record_history,
    record_status_change,
)
from app.services.de_findings import FindingStatusError, apply_closure_side_effects, check_finding_transition

router = APIRouter(prefix="/de-account-audit", tags=["DE Account Audit"])

_write_roles = (RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN)
_read_roles = (RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN, RoleCode.CXO)
_write = require_role(*_write_roles)
_read = [Depends(require_role(*_read_roles))]


async def _require_allocated_account(db: AsyncSession, account_id: UUID, user: User) -> Account:
    """The account must exist, be active and (unless Admin) have a DE allocated."""
    account = await db.get(Account, account_id)
    if account is None or not account.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    if account.delivery_excellence_id is None and await _role_code(db, user) != RoleCode.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account has no Delivery Excellence allocated")
    return account


# --- Queue ------------------------------------------------------------------


@router.get("/queue", response_model=DEAccountQueue, dependencies=_read)
async def audit_queue(db: AsyncSession = Depends(get_db)):
    return await build_queue(db)


# --- Audits -----------------------------------------------------------------


async def _audit_read(db: AsyncSession, audit: DEAccountAudit) -> DEAccountAuditRead:
    out = DEAccountAuditRead.model_validate(audit, from_attributes=True)
    if audit.audited_by is not None:
        user = await db.get(User, audit.audited_by)
        out.audited_by_name = user.full_name if user is not None else None
    return out


@router.get("/accounts/{account_id}/audits", response_model=list[DEAccountAuditRead], dependencies=_read)
async def list_audits(account_id: UUID, db: AsyncSession = Depends(get_db)):
    audits = (
        await db.execute(
            select(DEAccountAudit)
            .where(DEAccountAudit.account_id == account_id)
            .order_by(desc(DEAccountAudit.audit_date).nulls_last(), desc(DEAccountAudit.created_at))
            .limit(200)
        )
    ).scalars().all()
    return [await _audit_read(db, a) for a in audits]


@router.post(
    "/accounts/{account_id}/audits", response_model=DEAccountAuditRead, status_code=status.HTTP_201_CREATED
)
async def create_audit(
    account_id: UUID,
    payload: DEAccountAuditCreate,
    current_user: User = Depends(_write),
    db: AsyncSession = Depends(get_db),
):
    await _require_allocated_account(db, account_id, current_user)
    now = datetime.now(UTC)
    audit = DEAccountAudit(
        id=uuid4(),
        account_id=account_id,
        audit_date=payload.audit_date,
        de_assessed_health=payload.de_assessed_health,
        remarks=payload.remarks,
        status=payload.status,
        next_audit_due_date=payload.next_audit_due_date,
        period_id=payload.period_id,
        covered_project_ids=payload.covered_project_ids,
        audited_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    if payload.status == DEAssessmentStatus.SUBMITTED and audit.audit_date is None:
        audit.audit_date = date.today()
    await check_assessment_window(db, audit.period_id, audit.audit_date)
    db.add(audit)
    await db.flush()
    return await _audit_read(db, audit)


@router.patch("/audits/{audit_id}", response_model=DEAccountAuditRead)
async def update_audit(
    audit_id: UUID,
    payload: DEAccountAuditUpdate,
    current_user: User = Depends(_write),
    db: AsyncSession = Depends(get_db),
):
    audit = await db.get(DEAccountAudit, audit_id)
    if audit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Audit not found")
    await _require_allocated_account(db, audit.account_id, current_user)
    if audit.status != DEAssessmentStatus.DRAFT:
        raise HTTPException(status.HTTP_409_CONFLICT, "A submitted audit can no longer be edited")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(audit, field, value)
    if audit.status == DEAssessmentStatus.SUBMITTED:
        if audit.audit_date is None:
            audit.audit_date = date.today()
        if audit.audited_by is None:
            audit.audited_by = current_user.id
    await check_assessment_window(db, audit.period_id, audit.audit_date)
    audit.updated_at = datetime.now(UTC)
    await db.flush()
    return await _audit_read(db, audit)


# --- Findings (DE side) -----------------------------------------------------


@router.get("/findings", response_model=Page[DEAccountFindingRow], dependencies=_read)
async def get_findings(
    account_id: UUID | None = None,
    geo_id: UUID | None = None,
    classification: str | None = None,
    status: str | None = "Active",
    search: str | None = None,
    bucket: str | None = None,
    pagination: PaginationParams = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    filters = AccountFindingFilters(
        account_id=account_id,
        geo_id=geo_id,
        classification=classification,
        status=status,
        search=search,
        bucket=bucket,
    )
    items, total = await list_findings(db, filters, pagination.skip, pagination.limit)
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/findings/kpis", response_model=DEAccountFindingsKpis, dependencies=_read)
async def get_findings_kpis(account_id: UUID | None = None, db: AsyncSession = Depends(get_db)):
    return await findings_kpis(db, AccountFindingFilters(account_id=account_id))


@router.post("/findings", response_model=DEAccountFindingRead, status_code=status.HTTP_201_CREATED)
async def create_finding(
    payload: DEAccountFindingCreate,
    current_user: User = Depends(_write),
    db: AsyncSession = Depends(get_db),
):
    account = await _require_allocated_account(db, payload.account_id, current_user)
    project_ids = list(dict.fromkeys(payload.project_ids))
    if project_ids:
        valid = set(
            (
                await db.execute(
                    select(Project.id).where(Project.id.in_(project_ids), Project.account_id == account.id)
                )
            ).scalars()
        )
        if valid != set(project_ids):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Selected projects must belong to the account")
    now = datetime.now(UTC)
    finding = DEAccountFinding(
        id=uuid4(),
        account_id=account.id,
        sequence_no=await next_sequence_no(db, account.id),
        category=payload.category,
        classification=payload.classification,
        description=payload.description,
        finding_date=payload.finding_date,
        due_date=payload.due_date,
        project_ids=project_ids,
        status=FindingStatus.OPEN.value,
        created_at=now,
        updated_at=now,
    )
    db.add(finding)
    await db.flush()
    await record_history(
        db, finding.id, DEFindingHistoryEventType.CREATED, current_user.id, new_value=finding.status
    )
    await notify_svc.notify_many(
        db,
        await notify_svc.account_manager_ids(db, account.id),
        type="FINDING_RAISED",
        title=f"New DE finding on account {account.name}",
        body=finding.description,
        link="/account-findings",
        entity_type="account_finding",
        entity_id=finding.id,
        actor_id=current_user.id,
        data={"account_name": account.name, "classification": finding.classification},
    )
    return finding


@router.put("/findings/{finding_id}", response_model=DEAccountFindingRead)
async def update_finding(
    finding_id: UUID,
    payload: DEAccountFindingUpdate,
    current_user: User = Depends(_write),
    db: AsyncSession = Depends(get_db),
):
    finding = await db.get(DEAccountFinding, finding_id)
    if finding is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Finding not found")
    account = await _require_allocated_account(db, finding.account_id, current_user)

    old_status = finding.status
    new_status = payload.status.value if payload.status is not None else None
    try:
        check_finding_transition(old_status, new_status)
    except FindingStatusError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(finding, field, value)
    finding.updated_at = datetime.now(UTC)
    apply_closure_side_effects(finding, new_status)
    await db.flush()
    await record_status_change(db, finding.id, current_user.id, old_status, new_status)

    if new_status is not None and new_status != old_status:
        await notify_svc.notify_many(
            db,
            await notify_svc.account_manager_ids(db, account.id),
            type="FINDING_STATUS",
            title=f"Finding on account {account.name} is now {new_status}",
            body=finding.description,
            link="/account-findings",
            entity_type="account_finding",
            entity_id=finding.id,
            actor_id=current_user.id,
            data={"account_name": account.name, "status": new_status},
        )
    return finding


@router.get("/findings/{finding_id}/history", response_model=list[DEAccountFindingHistoryRead], dependencies=_read)
async def finding_history(finding_id: UUID, db: AsyncSession = Depends(get_db)):
    if await db.get(DEAccountFinding, finding_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Finding not found")
    return await list_history(db, finding_id)

