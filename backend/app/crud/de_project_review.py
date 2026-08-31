from app.crud.base import CRUDBase
from app.models.de_project_review import DeProjectModuleReview

# Rows are upserted by bespoke endpoint logic (de_approval.py) — one per
# (project, module_key) — so no Create/Update schema is needed here.
de_project_module_review_crud = CRUDBase(DeProjectModuleReview)
