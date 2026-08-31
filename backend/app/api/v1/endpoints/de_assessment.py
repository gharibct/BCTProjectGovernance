from datetime import UTC, date, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_project_access
from app.core.db import get_db
from app.crud.de_assessment import de_assessment_alert_crud, de_assessment_crud, de_assessment_finding_crud
from app.crud.projects import project_crud
from app.models.de_assessment import DEAssessment, DEAssessmentAlert, DEAssessmentFinding
from app.models.projects import Project
from app.schemas.de_assessment import (
    DEAssessmentAlertIn,
    DEAssessmentAlertRead,
    DEAssessmentCreate,
    DEAssessmentFindingIn,
    DEAssessmentFindingRead,
    DEAssessmentFindingUpdate,
    DEAssessmentRead,
    DEAssessmentReadWithDetails,
    DEAssessmentUpdate,
)
from app.schemas.enums import DEAssessmentStatus, RoleCode
from app.services.code_generator import generate_code
from app.services.health_rollup import compute_overall_project_health

router = APIRouter(prefix="/projects/{project_id}/de-assessments", tags=["DE Assessment"])

# PM/DE work — also reachable by an Account/Geo Head via the top-bar Work
# Context, scoped to projects in their own accounts/geo (require_project_access
# short-circuits for PROJECT_MANAGER / DELIVERY_EXCELLENCE / ADMIN).
_write_roles = [
    Depends(
        require_project_access(
            RoleCode.PROJECT_MANAGER,
            RoleCode.DELIVERY_EXCELLENCE,
            RoleCode.ACCOUNT_MANAGER,
            RoleCode.GEO_HEAD,
            RoleCode.ADMIN,
        )
    )
]


def _finalize_assessment(project: Project, assessment: DEAssessment) -> None:
    """Push a submitted assessment's rating into the Project Charter's cached
    health fields (UX §4.3/§4.12). Drafts never call this."""
    if assessment.assessment_date is None:
        assessment.assessment_date = date.today()
    project.de_assessed_project_health = assessment.de_assessed_project_health
    project.overall_project_health = compute_overall_project_health(
        project.delivery_declared_overall_health, assessment.de_assessed_project_health
    )


async def _load_with_details(db: AsyncSession, assessment: DEAssessment) -> DEAssessmentReadWithDetails:
    alerts = (
        (await db.execute(select(DEAssessmentAlert).where(DEAssessmentAlert.assessment_id == assessment.id)))
        .scalars()
        .all()
    )
    findings = (
        (
            await db.execute(
                select(DEAssessmentFinding)
                .where(DEAssessmentFinding.assessment_id == assessment.id)
                .order_by(DEAssessmentFinding.sequence_no)
            )
        )
        .scalars()
        .all()
    )
    return DEAssessmentReadWithDetails(
        **DEAssessmentRead.model_validate(assessment).model_dump(),
        alerts=[DEAssessmentAlertRead.model_validate(a) for a in alerts],
        findings=[DEAssessmentFindingRead.model_validate(f) for f in findings],
    )


@router.get("", response_model=list[DEAssessmentRead])
async def list_assessments(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await de_assessment_crud.list(
        db,
        filters={DEAssessment.project_id: project_id},
        order_by=desc(DEAssessment.assessment_date),
        limit=200,
    )
    return items


@router.get("/latest", response_model=DEAssessmentReadWithDetails)
async def get_latest_assessment(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await de_assessment_crud.list(
        db,
        filters={DEAssessment.project_id: project_id},
        order_by=desc(DEAssessment.assessment_date),
        limit=1,
    )
    if not items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No DE assessments recorded for this project")
    return await _load_with_details(db, items[0])


@router.get("/{assessment_id}", response_model=DEAssessmentReadWithDetails)
async def get_assessment(project_id: UUID, assessment_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await de_assessment_crud.get(db, assessment_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    return await _load_with_details(db, obj)


@router.post(
    "", response_model=DEAssessmentReadWithDetails, status_code=status.HTTP_201_CREATED, dependencies=_write_roles
)
async def create_assessment(project_id: UUID, payload: DEAssessmentCreate, db: AsyncSession = Depends(get_db)):
    project = await project_crud.get(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    now = datetime.now(UTC)
    assessment = DEAssessment(
        id=uuid4(),
        project_id=project_id,
        assessment_date=payload.assessment_date,
        de_assessed_project_health=payload.de_assessed_project_health,
        pci_score=payload.pci_score,
        remarks=payload.remarks,
        status=payload.status,
        next_assessment_due_date=payload.next_assessment_due_date,
        assessed_by=payload.assessed_by,
        created_at=now,
        updated_at=now,
    )
    db.add(assessment)
    await db.flush()

    if payload.status == DEAssessmentStatus.SUBMITTED:
        _finalize_assessment(project, assessment)
        await db.flush()

    return await _load_with_details(db, assessment)


@router.patch("/{assessment_id}", response_model=DEAssessmentReadWithDetails, dependencies=_write_roles)
async def update_assessment(
    project_id: UUID, assessment_id: UUID, payload: DEAssessmentUpdate, db: AsyncSession = Depends(get_db)
):
    assessment = await de_assessment_crud.get(db, assessment_id)
    if assessment is None or assessment.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    if assessment.status != DEAssessmentStatus.DRAFT:
        raise HTTPException(status.HTTP_409_CONFLICT, "A submitted assessment can no longer be edited")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(assessment, field, value)
    assessment.updated_at = datetime.now(UTC)
    await db.flush()

    if assessment.status == DEAssessmentStatus.SUBMITTED:
        project = await project_crud.get(db, project_id)
        if project is not None:
            _finalize_assessment(project, assessment)
    await db.flush()

    return await _load_with_details(db, assessment)


@router.post(
    "/{assessment_id}/alerts",
    response_model=DEAssessmentAlertRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=_write_roles,
)
async def add_alert(project_id: UUID, assessment_id: UUID, payload: DEAssessmentAlertIn, db: AsyncSession = Depends(get_db)):
    assessment = await de_assessment_crud.get(db, assessment_id)
    if assessment is None or assessment.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    alert_code = await generate_code(db, "DE_ALERT")
    return await de_assessment_alert_crud.create(
        db,
        payload,
        assessment_id=assessment_id,
        alert_code=alert_code,
        raised_on=payload.raised_on or assessment.assessment_date or date.today(),
    )


@router.post(
    "/{assessment_id}/findings",
    response_model=DEAssessmentFindingRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=_write_roles,
)
async def add_finding(project_id: UUID, assessment_id: UUID, payload: DEAssessmentFindingIn, db: AsyncSession = Depends(get_db)):
    assessment = await de_assessment_crud.get(db, assessment_id)
    if assessment is None or assessment.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    sequence_no = payload.sequence_no
    if sequence_no is None:
        current_max = (
            await db.execute(
                select(func.max(DEAssessmentFinding.sequence_no)).where(
                    DEAssessmentFinding.assessment_id == assessment_id
                )
            )
        ).scalar_one_or_none()
        sequence_no = (current_max or 0) + 1
    return await de_assessment_finding_crud.create(
        db, payload, assessment_id=assessment_id, sequence_no=sequence_no
    )


@router.put("/{assessment_id}/findings/{finding_id}", response_model=DEAssessmentFindingRead, dependencies=_write_roles)
async def update_finding(
    project_id: UUID,
    assessment_id: UUID,
    finding_id: UUID,
    payload: DEAssessmentFindingUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await de_assessment_finding_crud.get(db, finding_id)
    if obj is None or obj.assessment_id != assessment_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Finding not found")
    return await de_assessment_finding_crud.update(db, obj, payload)
