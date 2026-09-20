import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.core.config import settings

# Predefined (hand-formatted) Excel templates for the bulk / register import
# screens. The browser asks here first and falls back to its own auto-generated
# headers-only template on 404. File name: "<slug>-template.xlsx" inside
# settings.import_template_dir, where slug is the screen's plural item label
# lower-cased with non-alphanumerics collapsed to "-" (e.g. "projects",
# "delivery-status-projects").
router = APIRouter(prefix="/import-templates", tags=["Import Templates"])

_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/{slug}")
async def get_import_template(slug: str):
    if not _SLUG.fullmatch(slug):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    file_path = Path(settings.import_template_dir) / f"{slug}-template.xlsx"
    if not file_path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    return FileResponse(file_path, media_type=_XLSX, filename=file_path.name)
