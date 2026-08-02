from app.crud.base import CRUDBase
from app.models.raid import AssumptionLog, DependencyLog, IssueLog, OpportunityLog, RiskLog
from app.schemas.raid import (
    AssumptionLogCreate,
    AssumptionLogUpdate,
    DependencyLogCreate,
    DependencyLogUpdate,
    IssueLogCreate,
    IssueLogUpdate,
    OpportunityLogCreate,
    OpportunityLogUpdate,
    RiskLogCreate,
    RiskLogUpdate,
)

risk_log_crud = CRUDBase[RiskLog, RiskLogCreate, RiskLogUpdate](RiskLog)
issue_log_crud = CRUDBase[IssueLog, IssueLogCreate, IssueLogUpdate](IssueLog)
dependency_log_crud = CRUDBase[DependencyLog, DependencyLogCreate, DependencyLogUpdate](DependencyLog)
assumption_log_crud = CRUDBase[AssumptionLog, AssumptionLogCreate, AssumptionLogUpdate](AssumptionLog)
opportunity_log_crud = CRUDBase[OpportunityLog, OpportunityLogCreate, OpportunityLogUpdate](OpportunityLog)
