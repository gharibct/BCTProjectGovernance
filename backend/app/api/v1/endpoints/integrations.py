from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.factory import build_crud_router
from app.core.db import get_db
from app.crud.integrations import backup_restore_log_crud, integration_connection_crud
from app.models.integrations import BackupRestoreLog
from app.schemas.integrations import (
    BackupRestoreLogRead,
    BackupRestoreTrigger,
    IntegrationConnectionCreate,
    IntegrationConnectionRead,
    IntegrationConnectionUpdate,
)

router = APIRouter(tags=["Integrations"])

router.include_router(
    build_crud_router(
        prefix="/integrations",
        tags=["Integrations"],
        crud=integration_connection_crud,
        read_schema=IntegrationConnectionRead,
        create_schema=IntegrationConnectionCreate,
        update_schema=IntegrationConnectionUpdate,
    )
)


@router.get("/backup-restore-log", response_model=list[BackupRestoreLogRead])
async def list_backup_restore_log(db: AsyncSession = Depends(get_db)):
    items, _ = await backup_restore_log_crud.list(
        db, order_by=BackupRestoreLog.started_at.desc(), limit=200
    )
    return items


@router.post("/backup-restore-log", response_model=BackupRestoreLogRead, status_code=status.HTTP_201_CREATED)
async def trigger_backup_restore(payload: BackupRestoreTrigger, db: AsyncSession = Depends(get_db)):
    now = datetime.now(UTC)
    log = BackupRestoreLog(
        id=uuid4(),
        action=payload.action,
        status="In Progress",
        triggered_by=payload.triggered_by,
        started_at=now,
        details=payload.details,
    )
    db.add(log)
    await db.flush()
    return log
