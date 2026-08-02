from app.crud.base import CRUDBase
from app.models.contractual import (
    ContractualCommitment,
    ContractualCommitmentActual,
    MilestonePayment,
    MilestonePaymentActual,
)
from app.schemas.contractual import (
    ContractualCommitmentActualCreate,
    ContractualCommitmentCreate,
    ContractualCommitmentUpdate,
    MilestonePaymentActualUpsert,
    MilestonePaymentCreate,
    MilestonePaymentUpdate,
)

contractual_commitment_crud = CRUDBase[ContractualCommitment, ContractualCommitmentCreate, ContractualCommitmentUpdate](
    ContractualCommitment
)
contractual_commitment_actual_crud = CRUDBase[
    ContractualCommitmentActual, ContractualCommitmentActualCreate, ContractualCommitmentActualCreate
](ContractualCommitmentActual)
milestone_payment_crud = CRUDBase[MilestonePayment, MilestonePaymentCreate, MilestonePaymentUpdate](MilestonePayment)
milestone_payment_actual_crud = CRUDBase[
    MilestonePaymentActual, MilestonePaymentActualUpsert, MilestonePaymentActualUpsert
](MilestonePaymentActual)
