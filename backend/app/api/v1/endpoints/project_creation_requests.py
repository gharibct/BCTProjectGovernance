"""New Project Creation flow. An Account Head / Geo Head submits a lightweight
creation request (project name + Project Manager + Oracle Project IDs); Delivery
Excellence approves it — materialising a real projects row in Draft plus its
project_oracle_ids — or rejects it with a mandatory reason, which retains the
request row as "Rejected" so the requester can see why. This is a separate cycle
from DE Project Approval (which reviews governance completeness of an
already-created project that a PM has sent for approval).
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.deps import _role_code, get_current_user, require_role
from app.core.db import get_db
from app.crud.projects import project_crud, project_oracle_id_crud
from app.models.project_creation_request import (
    ProjectCreationRequest,
    ProjectCreationRequestOracleId,
)
from app.models.reference_data import Account, Geo, Organization, Region
from app.models.users import User
from app.schemas.enums import ProjectStatus, RoleCode
from app.schemas.project_creation_request import (
    ProjectCreationApproveRequest,
    ProjectCreationRejectRequest,
    ProjectCreationRequestCreate,
    ProjectCreationRequestRow,
)
from app.schemas.projects import ProjectCreate, ProjectOracleIdCreate, ProjectRead
from app.services.code_generator import generate_code

router = APIRouter(prefix="/project-creation-requests", tags=["Project Creation Requests"])

# Creation is an Account Head / Geo Head function (no longer the PM's).
_submitter = require_role(RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN)
# The DE-owned approval side; AM/GH may read the queue to track their own requests.
_reviewer = require_role(RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN)
_reader = require_role(
    RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN, RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD
)

_STATUS_PENDING = "Pending"
_STATUS_APPROVED = "Approved"
_STATUS_REJECTED = "Rejected"


async def _user_name(db: AsyncSession, user_id: UUID | None) -> str | None:
    if user_id is None:
        return None
    user = await db.get(User, user_id)
    return user.full_name if user is not None else None


async def _ref_name(db: AsyncSession, model: type, ref_id: UUID | None) -> str | None:
    if ref_id is None:
        return None
    row = await db.get(model, ref_id)
    return getattr(row, "name", None) if row is not None else None


async def _oracle_ids(db: AsyncSession, request_id: UUID) -> list[str]:
    rows = (
        await db.execute(
            select(ProjectCreationRequestOracleId.oracle_project_id).where(
                ProjectCreationRequestOracleId.request_id == request_id
            )
        )
    ).scalars().all()
    return list(rows)


async def _to_row(
    db: AsyncSession,
    request: ProjectCreationRequest,
    *,
    pm_name: str | None = None,
    requester_name: str | None = None,
    oracle_ids: list[str] | None = None,
) -> ProjectCreationRequestRow:
    """Build the API row for one request. pm_name / requester_name / oracle_ids
    may be passed in when the caller already has them (e.g. from a join or the
    just-created rows); otherwise they are looked up here."""
    return ProjectCreationRequestRow(
        id=request.id,
        project_name=request.project_name,
        project_manager_id=request.project_manager_id,
        project_manager_name=pm_name or await _user_name(db, request.project_manager_id),
        organization_id=request.organization_id,
        organization_name=await _ref_name(db, Organization, request.organization_id),
        geo_id=request.geo_id,
        geo_name=await _ref_name(db, Geo, request.geo_id),
        region_id=request.region_id,
        region_name=await _ref_name(db, Region, request.region_id),
        account_id=request.account_id,
        account_name=await _ref_name(db, Account, request.account_id),
        oracle_project_ids=oracle_ids if oracle_ids is not None else await _oracle_ids(db, request.id),
        requested_by=request.requested_by,
        requested_by_name=requester_name or await _user_name(db, request.requested_by),
        status=request.status,
        review_remarks=request.review_remarks,
        reviewed_at=request.reviewed_at,
        created_at=request.created_at,
    )


@router.post("", response_model=ProjectCreationRequestRow, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: ProjectCreationRequestCreate,
    current_user: User = Depends(_submitter),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(UTC)
    request = ProjectCreationRequest(
        id=uuid4(),
        project_name=payload.project_name.strip(),
        project_manager_id=payload.project_manager_id,
        organization_id=payload.organization_id,
        geo_id=payload.geo_id,
        region_id=payload.region_id,
        account_id=payload.account_id,
        status=_STATUS_PENDING,
        requested_by=current_user.id,
        approved_project_id=None,
        reviewed_by=None,
        reviewed_at=None,
        review_remarks=None,
        created_at=now,
        updated_at=now,
    )
    db.add(request)

    seen: set[str] = set()
    oracle_ids: list[str] = []
    for raw in payload.oracle_project_ids:
        value = raw.strip()
        if not value or value in seen:
            continue
        seen.add(value)
        oracle_ids.append(value)
        db.add(
            ProjectCreationRequestOracleId(
                id=uuid4(), request_id=request.id, oracle_project_id=value, created_at=now
            )
        )
    if not oracle_ids:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "At least one Oracle Project ID is required."
        )

    await db.flush()
    return await _to_row(db, request, oracle_ids=oracle_ids)


@router.get("", response_model=list[ProjectCreationRequestRow])
async def list_requests(
    current_user: User = Depends(_reader),
    db: AsyncSession = Depends(get_db),
):
    pm = aliased(User)
    requester = aliased(User)
    stmt = (
        select(ProjectCreationRequest, pm.full_name, requester.full_name)
        .outerjoin(pm, pm.id == ProjectCreationRequest.project_manager_id)
        .outerjoin(requester, requester.id == ProjectCreationRequest.requested_by)
        .order_by(ProjectCreationRequest.created_at.desc())
    )
    # DE get the action queue — only Pending. Account / Geo Head see only what
    # they submitted, and also their Rejected requests (with the reason). Admin
    # can both review the Pending queue AND submit requests directly (e.g. via
    # the "Work as" Account/Geo Head context — a client-only concept the
    # backend never sees, so `current_user` is always the real Admin account),
    # so Admin gets the full Pending queue plus their own Rejected requests.
    role_code = await _role_code(db, current_user)
    if role_code in (RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD):
        stmt = stmt.where(
            ProjectCreationRequest.requested_by == current_user.id,
            ProjectCreationRequest.status.in_((_STATUS_PENDING, _STATUS_REJECTED)),
        )
    elif role_code == RoleCode.ADMIN:
        stmt = stmt.where(
            or_(
                ProjectCreationRequest.status == _STATUS_PENDING,
                (ProjectCreationRequest.requested_by == current_user.id)
                & (ProjectCreationRequest.status == _STATUS_REJECTED),
            )
        )
    else:
        stmt = stmt.where(ProjectCreationRequest.status == _STATUS_PENDING)

    records = (await db.execute(stmt)).all()
    return [
        await _to_row(db, request, pm_name=pm_name, requester_name=requester_name)
        for request, pm_name, requester_name in records
    ]


@router.post("/{request_id}/approve", response_model=ProjectRead)
async def approve_request(
    request_id: UUID,
    payload: ProjectCreationApproveRequest,
    current_user: User = Depends(_reviewer),
    db: AsyncSession = Depends(get_db),
):
    request = await db.get(ProjectCreationRequest, request_id)
    if request is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project creation request not found")
    if request.status != _STATUS_PENDING:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Request is {request.status}; only a Pending request can be approved.",
        )

    code = await generate_code(db, "PROJECT")
    project = await project_crud.create(
        db,
        ProjectCreate(
            project_name=request.project_name,
            project_manager_id=request.project_manager_id,
            organization_id=request.organization_id,
            geo_id=request.geo_id,
            region_id=request.region_id,
            account_id=request.account_id,
            created_by=request.requested_by,
        ),
        project_code=code,
        project_status=ProjectStatus.DRAFT,
    )
    for oracle_project_id in await _oracle_ids(db, request.id):
        await project_oracle_id_crud.create(
            db, ProjectOracleIdCreate(oracle_project_id=oracle_project_id), project_id=project.id
        )

    request.status = _STATUS_APPROVED
    request.approved_project_id = project.id
    request.reviewed_by = payload.reviewed_by
    request.reviewed_at = datetime.now(UTC)
    request.review_remarks = payload.remarks
    await db.flush()
    await db.refresh(project)
    return project


@router.post("/{request_id}/reject", response_model=ProjectCreationRequestRow)
async def reject_request(
    request_id: UUID,
    payload: ProjectCreationRejectRequest,
    current_user: User = Depends(_reviewer),
    db: AsyncSession = Depends(get_db),
):
    """Reject with a mandatory reason. The request row is retained as "Rejected"
    (not deleted) with the remarks, so the requester can see why. No project is
    created; the child Oracle ID rows are kept with the record."""
    request = await db.get(ProjectCreationRequest, request_id)
    if request is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project creation request not found")
    if request.status != _STATUS_PENDING:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Request is {request.status}; only a Pending request can be rejected.",
        )

    request.status = _STATUS_REJECTED
    request.reviewed_by = payload.reviewed_by
    request.reviewed_at = datetime.now(UTC)
    request.review_remarks = payload.remarks.strip()
    await db.flush()

    return await _to_row(db, request)
