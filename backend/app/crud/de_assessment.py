from app.crud.base import CRUDBase
from app.models.de_assessment import (
    DEAssessment,
    DEAssessmentAlert,
    DEAssessmentFinding,
    DEAssessmentFindingHistory,
)
from app.schemas.de_assessment import DEAssessmentFindingUpdate
from app.schemas.de_findings import DEFindingHistoryCreate

# DEAssessment itself is created via bespoke endpoint logic (header only —
# see de_assessment.py); no update schema either — a submitted assessment
# isn't edited. Alerts and Findings are each their own register, added one at
# a time after the assessment exists.
de_assessment_crud = CRUDBase(DEAssessment)
de_assessment_alert_crud = CRUDBase(DEAssessmentAlert)
de_assessment_finding_crud = CRUDBase[DEAssessmentFinding, DEAssessmentFindingUpdate, DEAssessmentFindingUpdate](
    DEAssessmentFinding
)
# Append-only — only .create() is ever called (no edit/delete for a history row).
de_assessment_finding_history_crud = CRUDBase[
    DEAssessmentFindingHistory, DEFindingHistoryCreate, DEFindingHistoryCreate
](DEAssessmentFindingHistory)
