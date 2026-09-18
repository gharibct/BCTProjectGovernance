"""GET /project-owned-reference — the explanatory text shown by the Project
Profile "Project Owned" field's info tooltip. Static bundled reference data
(app/data/project_owned_reference.yaml); every authenticated role reads it,
nobody writes it.
"""

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.project_owned_reference import ProjectOwnedReferenceEntry
from app.services.project_owned_reference import get_project_owned_reference

router = APIRouter(prefix="/project-owned-reference", tags=["Reference Data"])


@router.get("", response_model=dict[str, ProjectOwnedReferenceEntry])
async def read_project_owned_reference(_: object = Depends(get_current_user)):
    return get_project_owned_reference()
