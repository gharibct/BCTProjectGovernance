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
from app.schemas.de_findings import DEFindingCreate, DEFindingListRow, DEFindingsKpis
from app.schemas.enums import RoleCode
from app.services.de_findings import (
    DEFindingFilters,
    create_project_finding,
    de_findings_kpis,
    list_de_findings,
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
    return await create_project_finding(db, payload.project_id, finding_in)


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
    return await de_assessment_finding_crud.update(db, obj, payload)
