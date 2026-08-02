from app.crud.base import CRUDBase
from app.models.de_assessment import DEAssessment, DEAssessmentFinding
from app.schemas.de_assessment import DEAssessmentFindingUpdate

# DEAssessment itself is created via bespoke endpoint logic (nested alert +
# findings); no update schema either — a submitted assessment isn't edited.
de_assessment_crud = CRUDBase(DEAssessment)
de_assessment_finding_crud = CRUDBase[DEAssessmentFinding, DEAssessmentFindingUpdate, DEAssessmentFindingUpdate](
    DEAssessmentFinding
)
