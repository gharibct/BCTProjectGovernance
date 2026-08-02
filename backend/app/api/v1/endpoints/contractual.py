from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.schemas.contractual import (
    ContractualCommitmentActualCreate,
    ContractualCommitmentActualRead,
    ContractualCommitmentCreate,
    ContractualCommitmentRead,
    ContractualCommitmentUpdate,
    MilestonePaymentActualRead,
    MilestonePaymentActualUpsert,
    MilestonePaymentCreate,
    MilestonePaymentRead,
    MilestonePaymentUpdate,
)

router = APIRouter(tags=["Contractual Compliance"])


# --- Commitments ---

commitments_router = APIRouter(prefix="/projects/{project_id}/contractual-commitments")


@commitments_router.get("", response_model=list[ContractualCommitmentRead])
async def list_commitments(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await contractual_commitment_crud.list(
        db, filters={ContractualCommitment.project_id: project_id}, limit=500
    )
    return items


@commitments_router.post("", response_model=ContractualCommitmentRead, status_code=status.HTTP_201_CREATED)
async def create_commitment(project_id: UUID, payload: ContractualCommitmentCreate, db: AsyncSession = Depends(get_db)):
    return await contractual_commitment_crud.create(db, payload, project_id=project_id)


@commitments_router.get("/{commitment_id}", response_model=ContractualCommitmentRead)
async def get_commitment(project_id: UUID, commitment_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await contractual_commitment_crud.get(db, commitment_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found")
    return obj


@commitments_router.put("/{commitment_id}", response_model=ContractualCommitmentRead)
async def update_commitment(
    project_id: UUID, commitment_id: UUID, payload: ContractualCommitmentUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await contractual_commitment_crud.get(db, commitment_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found")
    return await contractual_commitment_crud.update(db, obj, payload)


@commitments_router.delete("/{commitment_id}", status_code=status.HTTP_204_NO_CONTENT)
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
    "/{commitment_id}/actuals", response_model=ContractualCommitmentActualRead, status_code=status.HTTP_201_CREATED
)
async def create_commitment_actual(
    project_id: UUID,
    commitment_id: UUID,
    payload: ContractualCommitmentActualCreate,
    db: AsyncSession = Depends(get_db),
):
    commitment = await contractual_commitment_crud.get(db, commitment_id)
    if commitment is None or commitment.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found")
    return await contractual_commitment_actual_crud.create(db, payload, commitment_id=commitment_id)


# --- Milestone Payments ---

milestones_router = APIRouter(prefix="/projects/{project_id}/milestone-payments")


@milestones_router.get("", response_model=list[MilestonePaymentRead])
async def list_milestones(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await milestone_payment_crud.list(db, filters={MilestonePayment.project_id: project_id}, limit=500)
    return items


@milestones_router.post("", response_model=MilestonePaymentRead, status_code=status.HTTP_201_CREATED)
async def create_milestone(project_id: UUID, payload: MilestonePaymentCreate, db: AsyncSession = Depends(get_db)):
    return await milestone_payment_crud.create(db, payload, project_id=project_id)


@milestones_router.get("/{milestone_id}", response_model=MilestonePaymentRead)
async def get_milestone(project_id: UUID, milestone_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await milestone_payment_crud.get(db, milestone_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone not found")
    return obj


@milestones_router.put("/{milestone_id}", response_model=MilestonePaymentRead)
async def update_milestone(
    project_id: UUID, milestone_id: UUID, payload: MilestonePaymentUpdate, db: AsyncSession = Depends(get_db)
):
    obj = await milestone_payment_crud.get(db, milestone_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone not found")
    return await milestone_payment_crud.update(db, obj, payload)


@milestones_router.delete("/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@milestones_router.put("/{milestone_id}/actual", response_model=MilestonePaymentActualRead)
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
