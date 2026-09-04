from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_project_access
from app.core.db import get_db
from app.crud.contractual import (
    contractual_commitment_actual_crud,
    contractual_commitment_crud,
    milestone_payment_actual_crud,
    milestone_payment_crud,
)
from app.models.contractual import (
    ContractualCommitment,
    ContractualCommitmentActual,
    MilestonePayment,
    MilestonePaymentActual,
)
from app.models.users import User
from app.schemas.contractual import (
    ContractualCommitmentActualCreate,
    ContractualCommitmentActualRead,
    ContractualCommitmentActualUpdate,
    ContractualCommitmentCreate,
    ContractualCommitmentRead,
    ContractualCommitmentUpdate,
    MilestonePaymentActualRead,
    MilestonePaymentActualUpsert,
    MilestonePaymentCreate,
    MilestonePaymentRead,
    MilestonePaymentUpdate,
)
from app.schemas.enums import RoleCode

router = APIRouter(tags=["Contractual Compliance"])

# PM work — also reachable by an Account/Geo Head via the top-bar Work Context,
# scoped to projects in their own accounts/geo (require_project_access).
_pm_write_dep = require_project_access(
    RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN
)
_pm_write = [Depends(_pm_write_dep)]


# --- Commitments ---

commitments_router = APIRouter(prefix="/projects/{project_id}/contractual-commitments")


@commitments_router.get("", response_model=list[ContractualCommitmentRead])
async def list_commitments(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await contractual_commitment_crud.list(
        db, filters={ContractualCommitment.project_id: project_id}, limit=500
    )
    return items


@commitments_router.post(
    "", response_model=ContractualCommitmentRead, status_code=status.HTTP_201_CREATED, dependencies=_pm_write
)
async def create_commitment(project_id: UUID, payload: ContractualCommitmentCreate, db: AsyncSession = Depends(get_db)):
    return await contractual_commitment_crud.create(db, payload, project_id=project_id)


@commitments_router.get("/{commitment_id}", response_model=ContractualCommitmentRead)
async def get_commitment(project_id: UUID, commitment_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await contractual_commitment_crud.get(db, commitment_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found")
    return obj


@commitments_router.put("/{commitment_id}", response_model=ContractualCommitmentRead, dependencies=_pm_write)
async def update_commitment(
    project_id: UUID, commitment_id: UUID, payload: ContractualCommitmentUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await contractual_commitment_crud.get(db, commitment_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found")
    return await contractual_commitment_crud.update(db, obj, payload)


@commitments_router.delete("/{commitment_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_pm_write)
async def delete_commitment(project_id: UUID, commitment_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await contractual_commitment_crud.get(db, commitment_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found")
    await contractual_commitment_crud.delete(db, obj)


@commitments_router.get("/{commitment_id}/actuals", response_model=list[ContractualCommitmentActualRead])
async def list_commitment_actuals(project_id: UUID, commitment_id: UUID, db: AsyncSession = Depends(get_db)):
    commitment = await contractual_commitment_crud.get(db, commitment_id)
    if commitment is None or commitment.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found")
    items, _ = await contractual_commitment_actual_crud.list(
        db,
        filters={ContractualCommitmentActual.commitment_id: commitment_id},
        order_by=desc(ContractualCommitmentActual.period_date),
        limit=500,
    )
    return items


@commitments_router.post(
    "/{commitment_id}/actuals",
    response_model=ContractualCommitmentActualRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_commitment_actual(
    project_id: UUID,
    commitment_id: UUID,
    payload: ContractualCommitmentActualCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_pm_write_dep),
):
    """Record an actual reading for the commitment's period ending `period_date`.

    Upsert on (commitment_id, period_date) — re-recording an existing date
    overwrites that row (matches the Measurement / Milestone-actual convention
    and the table's UNIQUE constraint). `recorded_by` is always stamped from
    the session, never the payload.
    """
    commitment = await contractual_commitment_crud.get(db, commitment_id)
    if commitment is None or commitment.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found")

    existing, _ = await contractual_commitment_actual_crud.list(
        db,
        filters={
            ContractualCommitmentActual.commitment_id: commitment_id,
            ContractualCommitmentActual.period_date: payload.period_date,
        },
        limit=1,
    )
    if existing:
        row = await contractual_commitment_actual_crud.update(
            db,
            existing[0],
            ContractualCommitmentActualUpdate(
                actual_value=payload.actual_value, met_status=payload.met_status
            ),
        )
        row.recorded_by = user.id
        await db.flush()
        await db.refresh(row)
        return row

    return await contractual_commitment_actual_crud.create(
        db, payload, commitment_id=commitment_id, recorded_by=user.id
    )


async def _get_actual_or_404(
    db: AsyncSession, project_id: UUID, commitment_id: UUID, actual_id: UUID
) -> ContractualCommitmentActual:
    commitment = await contractual_commitment_crud.get(db, commitment_id)
    if commitment is None or commitment.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found")
    actual = await contractual_commitment_actual_crud.get(db, actual_id)
    if actual is None or actual.commitment_id != commitment_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment actual not found")
    return actual


@commitments_router.put(
    "/{commitment_id}/actuals/{actual_id}",
    response_model=ContractualCommitmentActualRead,
)
async def update_commitment_actual(
    project_id: UUID,
    commitment_id: UUID,
    actual_id: UUID,
    payload: ContractualCommitmentActualUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_pm_write_dep),
):
    actual = await _get_actual_or_404(db, project_id, commitment_id, actual_id)
    row = await contractual_commitment_actual_crud.update(db, actual, payload)
    row.recorded_by = user.id
    await db.flush()
    await db.refresh(row)
    return row


@commitments_router.delete(
    "/{commitment_id}/actuals/{actual_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=_pm_write,
)
async def delete_commitment_actual(
    project_id: UUID,
    commitment_id: UUID,
    actual_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    actual = await _get_actual_or_404(db, project_id, commitment_id, actual_id)
    await contractual_commitment_actual_crud.delete(db, actual)


# --- Milestone Payments ---

milestones_router = APIRouter(prefix="/projects/{project_id}/milestone-payments")


@milestones_router.get("", response_model=list[MilestonePaymentRead])
async def list_milestones(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await milestone_payment_crud.list(db, filters={MilestonePayment.project_id: project_id}, limit=500)
    return items


@milestones_router.post(
    "", response_model=MilestonePaymentRead, status_code=status.HTTP_201_CREATED, dependencies=_pm_write
)
async def create_milestone(project_id: UUID, payload: MilestonePaymentCreate, db: AsyncSession = Depends(get_db)):
    return await milestone_payment_crud.create(db, payload, project_id=project_id)


@milestones_router.get("/{milestone_id}", response_model=MilestonePaymentRead)
async def get_milestone(project_id: UUID, milestone_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await milestone_payment_crud.get(db, milestone_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone not found")
    return obj


@milestones_router.put("/{milestone_id}", response_model=MilestonePaymentRead, dependencies=_pm_write)
async def update_milestone(
    project_id: UUID, milestone_id: UUID, payload: MilestonePaymentUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await milestone_payment_crud.get(db, milestone_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone not found")
    return await milestone_payment_crud.update(db, obj, payload)


@milestones_router.delete("/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_pm_write)
async def delete_milestone(project_id: UUID, milestone_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await milestone_payment_crud.get(db, milestone_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone not found")
    await milestone_payment_crud.delete(db, obj)


@milestones_router.get("/{milestone_id}/actual", response_model=MilestonePaymentActualRead)
async def get_milestone_actual(project_id: UUID, milestone_id: UUID, db: AsyncSession = Depends(get_db)):
    milestone = await milestone_payment_crud.get(db, milestone_id)
    if milestone is None or milestone.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone not found")
    items, _ = await milestone_payment_actual_crud.list(
        db, filters={MilestonePaymentActual.milestone_id: milestone_id}, limit=1
    )
    if not items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No payment actual recorded for this milestone")
    return items[0]


@milestones_router.put("/{milestone_id}/actual", response_model=MilestonePaymentActualRead, dependencies=_pm_write)
async def upsert_milestone_actual(
    project_id: UUID,
    milestone_id: UUID,
    payload: MilestonePaymentActualUpsert,
    db: AsyncSession = Depends(get_db),
):
    milestone = await milestone_payment_crud.get(db, milestone_id)
    if milestone is None or milestone.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone not found")

    items, _ = await milestone_payment_actual_crud.list(
        db, filters={MilestonePaymentActual.milestone_id: milestone_id}, limit=1
    )
    if items:
        return await milestone_payment_actual_crud.update(db, items[0], payload)
    return await milestone_payment_actual_crud.create(db, payload, milestone_id=milestone_id)


router.include_router(commitments_router)
router.include_router(milestones_router)
