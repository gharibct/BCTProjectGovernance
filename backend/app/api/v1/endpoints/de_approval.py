"""DE Project Approval (design-reference/de-approval) — the allocated Delivery
Excellence assessor reviews a project's governance completeness module by module
and either Approves it (project_status -> Approved) or Returns it to the PM
(project_status -> Draft). de_review_status carries the review sub-state.
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.deps import get_current_user, require_project_de_scope, require_role
from app.core.db import get_db
from app.crud.projects import project_crud
from app.models.de_project_review import DeProjectModuleReview
from app.models.projects import Project
from app.models.reference_data import Account, Geo, ProjectType, Region
from app.models.users import User
from app.schemas.de_approval import (
    DeApprovalKpis,
    DeApprovalQueueResponse,
    DeApprovalQueueRow,
    DeModuleReviewUpdate,
    DeReviewDecisionRequest,
    DeReviewDetail,
    GovernanceModuleStatus,
)
from app.schemas.enums import (
    DeModuleReviewAction,
    DeReviewStatus,
    GovernanceModuleKey,
    ProjectStatus,
    RoleCode,
)
from app.services.amendment import active_amendment
from app.services.governance_completeness import compute_governance_completeness

router = APIRouter(prefix="/de-approval", tags=["DE Approval"])

_de = require_role(RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN)
_de_scope = require_project_de_scope(RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN)


async def _module_reviews(db: AsyncSession, project_id: UUID) -> dict[str, DeProjectModuleReview]:
    rows = (
        (await db.execute(select(DeProjectModuleReview).where(DeProjectModuleReview.project_id == project_id)))
        .scalars()
        .all()
    )
    return {r.module_key: r for r in rows}


async def _user_name(db: AsyncSession, user_id: UUID | None) -> str | None:
    if user_id is None:
        return None
    user = await db.get(User, user_id)
    return user.full_name if user is not None else None


async def _account_name(db: AsyncSession, account_id: UUID | None) -> str | None:
    if account_id is None:
        return None
    account = await db.get(Account, account_id)
    return account.name if account is not None else None


async def _build_detail(db: AsyncSession, project: Project) -> DeReviewDetail:
    completeness = await compute_governance_completeness(db, project)
    reviews = await _module_reviews(db, project.id)
    for module in completeness.modules:
        row = reviews.get(module.key.value)
        if row is not None:
            module.review_action = DeModuleReviewAction(row.review_action)
            module.last_updated = row.updated_at
    return DeReviewDetail(
        project_id=project.id,
        project_code=project.project_code,
        project_name=project.project_name,
        account_name=await _account_name(db, project.account_id),
        project_manager_name=await _user_name(db, project.project_manager_id),
        project_status=project.project_status,
        lifecycle_status=project.lifecycle_status,
        de_review_status=project.de_review_status,
        de_review_remarks=project.de_review_remarks,
        de_reviewed_by=project.de_reviewed_by,
        de_reviewed_at=project.de_reviewed_at,
        completeness=completeness,
    )


@router.get("/queue", response_model=DeApprovalQueueResponse)
async def approval_queue(
    period_id: UUID | None = None,  # display filter only — echoed, not applied
    current_user: User = Depends(_de),
    db: AsyncSession = Depends(get_db),
):
    # Scoped to the signed-in DE's allocations, the same session-derived
    # convention as GET /dashboard/de-summary.
    pm = aliased(User)
    stmt = (
        select(Project, pm.full_name, Account.name, Geo.name, Region.name, ProjectType.name)
        .outerjoin(pm, pm.id == Project.project_manager_id)
        .outerjoin(Account, Account.id == Project.account_id)
        .outerjoin(Geo, Geo.id == Project.geo_id)
        .outerjoin(Region, Region.id == Project.region_id)
        .outerjoin(ProjectType, ProjectType.id == Project.project_type_id)
        .where(Project.delivery_excellence_id == current_user.id)
    )
    records = (await db.execute(stmt)).all()

    kpis = DeApprovalKpis(awaiting_review=0, in_review=0, returned=0)
    rows: list[DeApprovalQueueRow] = []
    for project, pm_name, account_name, geo_name, region_name, project_type_name in records:
        review_status = project.de_review_status
        awaiting = project.project_status == ProjectStatus.PENDING_APPROVAL and review_status is None
        if awaiting:
            kpis.awaiting_review += 1
        elif review_status == DeReviewStatus.IN_REVIEW:
            kpis.in_review += 1
        elif review_status == DeReviewStatus.RETURNED:
            kpis.returned += 1

        if review_status == DeReviewStatus.APPROVED:
            continue
        if project.project_status != ProjectStatus.PENDING_APPROVAL and review_status is None:
            continue

        completeness = await compute_governance_completeness(db, project)
        rows.append(
            DeApprovalQueueRow(
                project_id=project.id,
                project_code=project.project_code,
                project_name=project.project_name,
                account_name=account_name,
                geo_name=geo_name,
                region_name=region_name,
                project_type_name=project_type_name,
                project_manager_name=pm_name,
                completion_pct=completeness.completion_pct,
                gaps_count=completeness.gaps_count,
                project_status=project.project_status,
                lifecycle_status=project.lifecycle_status,
                de_review_status=review_status,
                last_updated=project.updated_at,
                href=f"/de-approval/{project.id}",
            )
        )

    return DeApprovalQueueResponse(period_id=period_id, kpis=kpis, rows=rows)


@router.get("/{project_id}", response_model=DeReviewDetail, dependencies=[Depends(_de_scope)])
async def get_review_detail(project_id: UUID, db: AsyncSession = Depends(get_db)):
    project = await project_crud.get(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return await _build_detail(db, project)


@router.put(
    "/{project_id}/modules/{module_key}",
    response_model=GovernanceModuleStatus,
    dependencies=[Depends(_de_scope)],
)
async def set_module_review(
    project_id: UUID,
    module_key: GovernanceModuleKey,
    payload: DeModuleReviewUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await project_crud.get(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    now = datetime.now(UTC)
    existing = (
        (
            await db.execute(
                select(DeProjectModuleReview).where(
                    DeProjectModuleReview.project_id == project_id,
                    DeProjectModuleReview.module_key == module_key.value,
                )
            )
        )
        .scalars()
        .all()
    )
    if existing:
        review = existing[0]
        review.review_action = payload.review_action
        review.remarks = payload.remarks
        review.updated_by = current_user.id
        review.updated_at = now
    else:
        review = DeProjectModuleReview(
            id=uuid4(),
            project_id=project_id,
            module_key=module_key.value,
            review_action=payload.review_action,
            remarks=payload.remarks,
            updated_by=current_user.id,
            created_at=now,
            updated_at=now,
        )
        db.add(review)

    # Opening the workspace and marking any module moves the project from
    # "Awaiting Review" to "In Review".
    if project.de_review_status is None and project.project_status == ProjectStatus.PENDING_APPROVAL:
        project.de_review_status = DeReviewStatus.IN_REVIEW

    await db.flush()

    completeness = await compute_governance_completeness(db, project)
    module = next(m for m in completeness.modules if m.key == module_key)
    module.review_action = DeModuleReviewAction(review.review_action)
    module.last_updated = review.updated_at
    return module


@router.patch("/{project_id}/decision", response_model=DeReviewDetail, dependencies=[Depends(_de_scope)])
async def submit_decision(
    project_id: UUID,
    payload: DeReviewDecisionRequest,
    db: AsyncSession = Depends(get_db),
):
    project = await project_crud.get(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if project.project_status != ProjectStatus.PENDING_APPROVAL:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a project Pending Approval can be reviewed")

    amendment = await active_amendment(db, project_id)
    project.de_review_remarks = payload.remarks
    project.de_reviewed_by = payload.reviewed_by
    project.de_reviewed_at = datetime.now(UTC)
    if payload.decision == "Approve":
        project.project_status = ProjectStatus.APPROVED
        project.de_review_status = DeReviewStatus.APPROVED
        if amendment is not None:
            amendment.status = "Completed"
            amendment.completed_at = datetime.now(UTC)
    else:  # Return
        # An amendment goes back to Under Amendment for further edits; a
        # first-time approval goes back to Draft.
        project.project_status = (
            ProjectStatus.UNDER_AMENDMENT if amendment is not None else ProjectStatus.DRAFT
        )
        project.de_review_status = DeReviewStatus.RETURNED
        if amendment is not None:
            amendment.status = "In Progress"
            amendment.submitted_at = None

    await db.flush()
    await db.refresh(project)
    return await _build_detail(db, project)
