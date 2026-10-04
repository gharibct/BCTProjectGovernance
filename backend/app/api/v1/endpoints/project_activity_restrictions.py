from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_project_read_access, require_role
from app.core.db import get_db
from app.models.projects import Project, ProjectActivityRestriction
from app.models.users import User
from app.schemas.enums import ProjectActivity, RoleCode
from app.schemas.project_activity_restrictions import (
    ProjectActivityRestrictionRead,
    ProjectActivityRestrictionWrite,
)

# Per-project activity restrictions (db/tables/58_project_activity_restrictions.sql).
# Anyone who can read the project sees them (screens use them to show a
# "not required" notice and go read-only); only Admin and Delivery Excellence
# set or lift one. A restriction is a single row per (project, activity) with a
# "not required from" date.
router = APIRouter(prefix="/projects/{project_id}/activity-restrictions", tags=["Activity Restrictions"])

# Every restriction, across projects — a small table that the project pickers use to
# leave a project out of a screen whose activity is switched off for it. Any signed-in
# user may read it (it only says which activity stops being required from when).
all_router = APIRouter(prefix="/activity-restrictions", tags=["Activity Restrictions"])


@all_router.get("", response_model=list[ProjectActivityRestrictionRead], dependencies=[Depends(get_current_user)])
async def list_all_restrictions(db: AsyncSession = Depends(get_db)):
    return list((await db.execute(select(ProjectActivityRestriction))).scalars().all())

_read = [Depends(require_project_read_access())]
_write = [Depends(require_role(RoleCode.ADMIN, RoleCode.DELIVERY_EXCELLENCE))]


async def _get_project_or_404(db: AsyncSession, project_id: UUID) -> Project:
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


@router.get("", response_model=list[ProjectActivityRestrictionRead], dependencies=_read)
async def list_restrictions(project_id: UUID, db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(ProjectActivityRestriction)
            .where(ProjectActivityRestriction.project_id == project_id)
            .order_by(ProjectActivityRestriction.activity)
        )
    ).scalars()
    return list(rows)


@router.put("/{activity}", response_model=ProjectActivityRestrictionRead, dependencies=_write)
async def set_restriction(
    project_id: UUID,
    activity: ProjectActivity,
    payload: ProjectActivityRestrictionWrite,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Restrict `activity` from a date (or change that date). One row per activity."""
    await _get_project_or_404(db, project_id)
    now = datetime.now(UTC)
    row = (
        await db.execute(
            select(ProjectActivityRestriction).where(
                ProjectActivityRestriction.project_id == project_id,
                ProjectActivityRestriction.activity == activity.value,
            )
        )
    ).scalar_one_or_none()
    reason = (payload.reason or "").strip() or None
    if row is None:
        row = ProjectActivityRestriction(
            id=uuid4(),
            project_id=project_id,
            activity=activity.value,
            not_required_from=payload.not_required_from,
            reason=reason,
            created_by=current_user.id,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
    else:
        row.not_required_from = payload.not_required_from
        row.reason = reason
        row.updated_at = now
    await db.flush()
    await db.refresh(row)
    return row


@router.delete("/{activity}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_write)
async def lift_restriction(project_id: UUID, activity: ProjectActivity, db: AsyncSession = Depends(get_db)):
    await _get_project_or_404(db, project_id)
    row = (
        await db.execute(
            select(ProjectActivityRestriction).where(
                ProjectActivityRestriction.project_id == project_id,
                ProjectActivityRestriction.activity == activity.value,
            )
        )
    ).scalar_one_or_none()
    if row is not None:
        await db.delete(row)
        await db.flush()
