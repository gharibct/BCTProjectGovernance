from app.crud.base import CRUDBase
from app.models.documents import ProjectDocument
from app.schemas.documents import ProjectDocumentCreate, ProjectDocumentUpdate

project_document_crud = CRUDBase[ProjectDocument, ProjectDocumentCreate, ProjectDocumentUpdate](ProjectDocument)
