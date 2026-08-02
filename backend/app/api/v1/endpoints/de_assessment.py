from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.crud.de_assessment import de_assessment_crud, de_assessment_finding_crud
from app.crud.projects import project_crud
from app.models.de_assessment import DEAssessment, DEAssessmentAlert, DEAssessmentFinding
from app.schemas.de_assessment import (
    DEAssessmentAlertRead,
    DEAssessmentCreate,
    DEAssessmentFindingIn,
    DEAssessmentFindingRead,
    DEAssessmentFindingUpdate,
    DEAssessmentRead,
    DEAssessmentReadWithDetails,
)
from app.services.code_generator import generate_code
from app.services.de_assessment_alerts import validate_alert_requirement
from app.services.health_rollup import compute_overall_project_health

router = APIRouter(prefix="/projects/{project_id}/de-assessments", tags=["DE Assessment"])


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


@router.post("", response_model=DEAssessmentReadWithDetails, status_code=status.HTTP_201_CREATED)
async def create_assessment(project_id: UUID, payload: DEAssessmentCreate, db: AsyncSession = Depends(get_db)):
    project = await project_crud.get(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    error = validate_alert_requirement(payload.de_assessed_project_health, payload.alert is not None)
    if error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, error)

    now = datetime.now(UTC)
    assessment = DEAssessment(
        id=uuid4(),
        project_id=project_id,
        assessment_date=payload.assessment_date,
        de_assessed_project_health=payload.de_assessed_project_health,
        pci_score=payload.pci_score,
        next_assessment_due_date=payload.next_assessment_due_date,
        assessed_by=payload.assessed_by,
        created_at=now,
        updated_at=now,
    )
    db.add(assessment)
    await db.flush()

    if payload.alert is not None:
        alert_code = await generate_code(db, "DE_ALERT")
        db.add(
            DEAssessmentAlert(
                id=uuid4(),
                alert_code=alert_code,
                assessment_id=assessment.id,
                alert_category=payload.alert.alert_category,
                brief_description=payload.alert.brief_description,
                detailed_description=payload.alert.detailed_description,
                raised_by=payload.alert.raised_by,
                raised_on=payload.alert.raised_on or payload.assessment_date,
                created_at=now,
            )
        )

    for finding in payload.findings:
        db.add(
            DEAssessmentFinding(
                id=uuid4(),
                assessment_id=assessment.id,
                created_at=now,
                updated_at=now,
                **finding.model_dump(),
            )
        )
    await db.flush()

    # Keep the Project Charter's cached health fields in sync (UX §4.3/§4.12).
    project.de_assessed_project_health = payload.de_assessed_project_health
    project.overall_project_health = compute_overall_project_health(
        project.delivery_declared_overall_health, payload.de_assessed_project_health
    )
    await db.flush()

    return await _load_with_details(db, assessment)


@router.post("/{assessment_id}/findings", response_model=DEAssessmentFindingRead, status_code=status.HTTP_201_CREATED)
async def add_finding(project_id: UUID, assessment_id: UUID, payload: DEAssessmentFindingIn, db: AsyncSession = Depends(get_db)):
    assessment = await de_assessment_crud.get(db, assessment_id)
    if assessment is None or assessment.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    return await de_assessment_finding_crud.create(db, payload, assessment_id=assessment_id)


@router.put("/{assessment_id}/findings/{finding_id}", response_model=DEAssessmentFindingRead)
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
