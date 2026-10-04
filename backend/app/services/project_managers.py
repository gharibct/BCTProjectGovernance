"""Project Managers and their proxies.

A project has one Primary PM (projects.project_manager_id) plus any number of
proxies (project_proxy_managers). Proxies have the same rights as the Primary,
so "is a PM of the project" means either. Account Delivery Managers work the
same way: the is_proxy=False user_accounts row is the primary, the rest proxies.
"""

from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.projects import Project, ProjectProxyManager


def pm_condition(user_id: UUID):
    """WHERE condition: `user_id` is the Primary or a proxy PM of the project."""
    return or_(
        Project.project_manager_id == user_id,
        Project.id.in_(select(ProjectProxyManager.project_id).where(ProjectProxyManager.user_id == user_id)),
    )


async def proxy_pm_ids(db: AsyncSession, project_id: UUID) -> list[UUID]:
    rows = await db.execute(
        select(ProjectProxyManager.user_id)
        .where(ProjectProxyManager.project_id == project_id)
        .order_by(ProjectProxyManager.created_at)
    )
    return list(rows.scalars().all())


async def project_pm_ids(db: AsyncSession, project: Project) -> list[UUID]:
    """Primary PM first, then proxies (no duplicates, no Nones)."""
    ids: list[UUID] = []
    if project.project_manager_id is not None:
        ids.append(project.project_manager_id)
    for user_id in await proxy_pm_ids(db, project.id):
        if user_id not in ids:
            ids.append(user_id)
    return ids
