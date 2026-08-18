import asyncio
import re
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.core.config import settings
from app.core.db import get_db
from app.crud.documents import project_document_crud
from app.crud.projects import project_crud
from app.crud.reference_data import reporting_period_crud
from app.models.documents import ProjectDocument
from app.models.reference_data import ReportingPeriod
from app.schemas.documents import ProjectDocumentCreate, ProjectDocumentRead
from app.schemas.enums import DocumentAiStatus, DocumentContext, RoleCode

# AI Hub > Document Processing (New Project and Project Reporting both use
# this one router). Files are stored on local disk under
# settings.document_storage_dir, one subfolder per project:
#   "<project_code>_create" for uploads made while the project is still being
#   set up (New Project), "<project_code>_<reporting_period.code>" for
#   uploads made against a specific Weekly/Monthly report (Project
#   Reporting). project_code (not project_name) since it's the stable,
#   unique, filesystem-safe identifier — project_name is free text and can
#   collide across projects. "Process" is a stub status transition, not real
#   extraction — see ai_suggestions.py / ai_row_suggestions.py, the same
#   boundary applies here: no real AI/LLM pipeline exists in this repo yet.
router = APIRouter(prefix="/projects/{project_id}/documents", tags=["Documents"])

_pm_write = [Depends(require_role(RoleCode.PROJECT_MANAGER, RoleCode.ADMIN))]

_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9_-]+")


def _sanitize_segment(value: str) -> str:
    cleaned = _UNSAFE_CHARS.sub("_", value.strip()).strip("_")
    return cleaned or "untitled"


def _infer_file_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("docx", "doc"):
        return "DOCX"
    if ext == "pdf":
        return "PDF"
    if ext in ("xlsx", "xls"):
        return "XLSX"
    return "OTHER"


async def _get_project_or_404(project_id: UUID, db: AsyncSession):
    project = await project_crud.get(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


async def _get_document_or_404(project_id: UUID, document_id: UUID, db: AsyncSession) -> ProjectDocument:
    doc = await project_document_crud.get(db, document_id)
    if doc is None or doc.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return doc


async def _get_baseline_period_id(db: AsyncSession) -> UUID:
    """The sentinel reporting_periods row (code='BASELINE', seeded in
    db/seed_dev.sql) that project-creation-time records reference instead of
    a real Weekly/Monthly period — same one health_declarations' initial,
    pre-reporting-cycle declaration uses."""
    items, _ = await reporting_period_crud.list(db, limit=1, filters={ReportingPeriod.code: "BASELINE"})
    if not items:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Baseline reporting period not seeded")
    return items[0].id


@router.get("", response_model=list[ProjectDocumentRead])
async def list_documents(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await project_document_crud.list(
        db,
        limit=200,
        filters={ProjectDocument.project_id: project_id},
        order_by=desc(ProjectDocument.created_at),
    )
    return items


@router.post("", response_model=ProjectDocumentRead, status_code=status.HTTP_201_CREATED, dependencies=_pm_write)
async def upload_document(
    project_id: UUID,
    file: UploadFile = File(...),
    context: DocumentContext = Form(...),
    period_id: UUID | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project_or_404(project_id, db)

    if context == DocumentContext.CREATE:
        folder = f"{_sanitize_segment(project.project_code)}_create"
        period_id = await _get_baseline_period_id(db)
    else:
        if period_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "period_id is required for reporting uploads")
        period = await reporting_period_crud.get(db, period_id)
        if period is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Reporting period not found")
        folder = f"{_sanitize_segment(project.project_code)}_{_sanitize_segment(period.code)}"

    original_name = file.filename or "untitled"
    doc_id = uuid4()
    # Sanitize the stem but keep the extension intact (for both on-disk
    # readability and _infer_file_type, which looks at file_name the same
    # way below).
    if "." in original_name:
        stem, ext = original_name.rsplit(".", 1)
        disk_name = f"{doc_id}_{_sanitize_segment(stem)}.{ext.lower()}"
    else:
        disk_name = f"{doc_id}_{_sanitize_segment(original_name)}"
    relative_path = f"{folder}/{disk_name}"

    base_dir = Path(settings.document_storage_dir)
    target_dir = base_dir / folder
    target_dir.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    (base_dir / relative_path).write_bytes(content)

    payload = ProjectDocumentCreate(
        file_name=original_name,
        file_type=_infer_file_type(original_name),
        storage_path=relative_path,
        context=context,
        period_id=period_id,
        ai_status=DocumentAiStatus.NOT_PROCESSED,
    )
    return await project_document_crud.create(db, payload, id=doc_id, project_id=project_id)


class DocumentProcessRequest(BaseModel):
    document_ids: list[UUID]


@router.post("/process", response_model=list[ProjectDocumentRead], dependencies=_pm_write)
async def process_documents(
    project_id: UUID,
    payload: DocumentProcessRequest,
    db: AsyncSession = Depends(get_db),
):
    await _get_project_or_404(project_id, db)

    docs = []
    for document_id in payload.document_ids:
        doc = await _get_document_or_404(project_id, document_id, db)
        if doc.ai_status == DocumentAiStatus.NOT_PROCESSED:
            docs.append(doc)

    if not docs:
        return []

    for doc in docs:
        doc.ai_status = DocumentAiStatus.PROCESSING
    await db.flush()

    # Simulated processing delay — no real extraction pipeline exists yet
    # (see module docstring above).
    await asyncio.sleep(1.5)

    for doc in docs:
        doc.ai_status = DocumentAiStatus.PROCESSED
    await db.flush()
    for doc in docs:
        await db.refresh(doc)

    return docs


@router.delete("/{document_id}", dependencies=_pm_write)
async def delete_document(project_id: UUID, document_id: UUID, db: AsyncSession = Depends(get_db)):
    doc = await _get_document_or_404(project_id, document_id, db)

    if doc.ai_status == DocumentAiStatus.NOT_PROCESSED:
        file_path = Path(settings.document_storage_dir) / doc.storage_path
        file_path.unlink(missing_ok=True)
        await project_document_crud.delete(db, doc)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    if doc.ai_status == DocumentAiStatus.PROCESSED:
        # Soft delete — keep the file and row for future reference, per the
        # frontend's existing Excluded semantics.
        doc.ai_status = DocumentAiStatus.EXCLUDED
        await db.flush()
        await db.refresh(doc)
        return ProjectDocumentRead.model_validate(doc)

    raise HTTPException(
        status.HTTP_400_BAD_REQUEST, f"Cannot delete a document with status '{doc.ai_status}'"
    )


@router.get("/{document_id}/download")
async def download_document(project_id: UUID, document_id: UUID, db: AsyncSession = Depends(get_db)):
    doc = await _get_document_or_404(project_id, document_id, db)
    file_path = Path(settings.document_storage_dir) / doc.storage_path
    if not file_path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found on disk")
    return FileResponse(file_path, filename=doc.file_name)
