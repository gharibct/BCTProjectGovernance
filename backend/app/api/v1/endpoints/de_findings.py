"""Portfolio-wide DE Findings API — a cross-project list + KPI read and a
body-carries-project create/update over the project-level
`de_assessment_findings` register. Role-gated to DELIVERY_EXCELLENCE / ADMIN
(no DE-allocation scoping on reads — DE sees every project's findings). The
project-scoped register lives at /projects/{id}/de-assessment-findings
(de_assessment.py) and shares the create helper.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    PaginationParams,
    pagination_params,
    require_de_findings_write,
    require_role,
)
from app.core.db import get_db
from app.crud.de_assessment import de_assessment_finding_crud
from app.crud.projects import project_crud
from app.schemas.common import Page
from app.schemas.de_assessment import (
    DEAssessmentFindingIn,
    DEAssessmentFindingRead,
    DEAssessmentFindingUpdate,
)
from app.schemas.de_findings import (
    DEFindingCreate,
    DEFindingHistoryRead,
    DEFindingListRow,
    DEFindingsKpis,
)
from app.schemas.enums import DEFindingHistoryEventType, RoleCode
from app.services import notifications as notify_svc
from app.services.de_findings import (
    DEFindingFilters,
    FindingStatusError,
    apply_closure_side_effects,
    check_finding_transition,
    create_project_finding,
    de_findings_kpis,
    list_de_findings,
    list_finding_history,
    record_finding_history,
    record_status_change,
)

router = APIRouter(prefix="/de-findings", tags=["DE Findings"])

_read_gate = [Depends(require_role(RoleCode.DELIVERY_EXCELLENCE, RoleCode.ADMIN))]


@router.get("", response_model=Page[DEFindingListRow], dependencies=_read_gate)
async def list_findings(
    geo_id: UUID | None = None,
    account_id: UUID | None = None,
    project_id: UUID | None = None,
    classification: str | None = None,
    status: str | None = "Active",
    search: str | None = None,
    bucket: str | None = None,
    pagination: PaginationParams = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    filters = DEFindingFilters(
        geo_id=geo_id,
        account_id=account_id,
        project_id=project_id,
        classification=classification,
        status=status,
        search=search,
        bucket=bucket,
    )
    items, total = await list_de_findings(db, filters, pagination.skip, pagination.limit)
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@router.get("/kpis", response_model=DEFindingsKpis, dependencies=_read_gate)
async def findings_kpis(
    geo_id: UUID | None = None,
    account_id: UUID | None = None,
    project_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    filters = DEFindingFilters(geo_id=geo_id, account_id=account_id, project_id=project_id)
    return await de_findings_kpis(db, filters)


@router.post("", response_model=DEAssessmentFindingRead, status_code=http_status.HTTP_201_CREATED)
async def create_finding(
    payload: DEFindingCreate,
    ctx=Depends(require_de_findings_write),
    db: AsyncSession = Depends(get_db),
):
    project = await project_crud.get(db, payload.project_id)
    if project is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Project not found")
    if ctx.role != RoleCode.ADMIN and project.delivery_excellence_id is None:
        raise HTTPException(
            http_status.HTTP_403_FORBIDDEN, "Project has no Delivery Excellence allocated"
        )
    finding_in = DEAssessmentFindingIn(**payload.model_dump(exclude={"project_id"}))
    obj = await create_project_finding(db, payload.project_id, finding_in)
    await record_finding_history(
        db, obj.id, DEFindingHistoryEventType.CREATED, ctx.user.id, new_value=obj.status
    )
    await notify_svc.notify(
        db,
        recipient_id=project.project_manager_id,
        type="FINDING_RAISED",
        title=f"New DE finding on {project.project_code}",
        body=obj.description,
        link="/pm-findings",
        entity_type="finding",
        entity_id=obj.id,
        actor_id=ctx.user.id,
        data={"project_code": project.project_code, "classification": obj.classification},
    )
    return obj


@router.put("/{finding_id}", response_model=DEAssessmentFindingRead)
async def update_finding(
    finding_id: UUID,
    payload: DEAssessmentFindingUpdate,
    ctx=Depends(require_de_findings_write),
    db: AsyncSession = Depends(get_db),
):
    obj = await de_assessment_finding_crud.get(db, finding_id)
    if obj is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Finding not found")
    project = await project_crud.get(db, obj.project_id)
    if ctx.role != RoleCode.ADMIN and (project is None or project.delivery_excellence_id is None):
        raise HTTPException(
            http_status.HTTP_403_FORBIDDEN, "Project has no Delivery Excellence allocated"
        )

    old_status = obj.status
    new_status = payload.status
    try:
        check_finding_transition(old_status, new_status)
    except FindingStatusError as exc:
        raise HTTPException(http_status.HTTP_409_CONFLICT, str(exc)) from exc

    updated = await de_assessment_finding_crud.update(db, obj, payload)
    apply_closure_side_effects(updated, new_status)
    await db.flush()

    await record_status_change(db, updated.id, ctx.user.id, old_status, new_status)

    if new_status != old_status and project is not None:
        await notify_svc.notify(
            db,
            recipient_id=project.project_manager_id,
            type="FINDING_STATUS",
            title=f"Finding on {project.project_code} is now {new_status}",
            body=updated.description,
            link="/pm-findings",
            entity_type="finding",
            entity_id=updated.id,
            actor_id=ctx.user.id,
            data={"project_code": project.project_code, "status": new_status},
        )
    return updated


@router.get(
    "/{finding_id}/history",
    response_model=list[DEFindingHistoryRead],
    dependencies=_read_gate,
)
async def get_finding_history(finding_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await de_assessment_finding_crud.get(db, finding_id)
    if obj is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Finding not found")
    return await list_finding_history(db, finding_id)
