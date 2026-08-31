"""RAID logs (UX §4.5-4.9) share one list/detail shape (UX §5 'RAID
consistency'), but the actual column names differ per entity (risk_owner vs
owner vs assigned_to, etc.), so this builds one parametrized router per entity
off a small RaidConfig rather than five hand-written near-duplicates.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, pagination_params, require_project_access
from app.core.db import get_db
from app.crud.base import CRUDBase
from app.crud.raid import (
    assumption_log_crud,
    dependency_log_crud,
    issue_log_crud,
    opportunity_log_crud,
    risk_log_crud,
)
from app.models.raid import AssumptionLog, DependencyLog, IssueLog, OpportunityLog, RiskLog
from app.schemas.common import Page
from app.schemas.enums import RoleCode
from app.schemas.raid import (
    AssumptionLogCreate,
    AssumptionLogRead,
    AssumptionLogUpdate,
    DependencyLogCreate,
    DependencyLogRead,
    DependencyLogUpdate,
    IssueLogCreate,
    IssueLogRead,
    IssueLogUpdate,
    OpportunityLogCreate,
    OpportunityLogRead,
    OpportunityLogUpdate,
    RiskLogCreate,
    RiskLogRead,
    RiskLogUpdate,
)
from app.services.code_generator import generate_code


@dataclass
class RaidConfig:
    prefix: str
    tag: str
    model: type
    crud: CRUDBase
    create_schema: type
    update_schema: type
    read_schema: type
    entity_code: str
    code_field: str
    title_field: str
    status_field: str
    category_field: str
    owner_field: str
    default_values: dict[str, Any] = field(default_factory=dict)
    has_review_dates: bool = True


# PM work — also reachable by an Account/Geo Head via the top-bar Work Context,
# scoped to projects in their own accounts/geo (require_project_access).
_pm_write = [Depends(require_project_access(RoleCode.PROJECT_MANAGER, RoleCode.ACCOUNT_MANAGER, RoleCode.GEO_HEAD, RoleCode.ADMIN))]


def build_raid_router(cfg: RaidConfig) -> APIRouter:
    router = APIRouter(prefix=f"/projects/{{project_id}}/{cfg.prefix}", tags=[cfg.tag])
    model = cfg.model
    crud = cfg.crud

    @router.get("", response_model=Page[cfg.read_schema])
    async def list_items(
        project_id: UUID,
        status_filter: str | None = Query(default=None, alias="status"),
        category: str | None = Query(default=None),
        owner: UUID | None = Query(default=None),
        search: str | None = Query(default=None, description="Search by title"),
        due_for_review: bool = Query(default=False),
        pagination: PaginationParams = Depends(pagination_params),
        db: AsyncSession = Depends(get_db),
    ):
        conditions = [model.project_id == project_id]
        if status_filter is not None:
            conditions.append(getattr(model, cfg.status_field) == status_filter)
        if category is not None:
            conditions.append(getattr(model, cfg.category_field) == category)
        if owner is not None:
            conditions.append(getattr(model, cfg.owner_field) == owner)
        if search:
            conditions.append(getattr(model, cfg.title_field).ilike(f"%{search}%"))
        if due_for_review and cfg.has_review_dates:
            conditions.append(model.next_review_date <= date.today())

        total = (await db.execute(select(func.count()).select_from(model).where(*conditions))).scalar_one()
        stmt = select(model).where(*conditions).offset(pagination.skip).limit(pagination.limit)
        items = (await db.execute(stmt)).scalars().all()
        return Page(items=list(items), total=total, skip=pagination.skip, limit=pagination.limit)

    @router.post("", response_model=cfg.read_schema, status_code=status.HTTP_201_CREATED, dependencies=_pm_write)
    async def create_item(project_id: UUID, payload: cfg.create_schema, db: AsyncSession = Depends(get_db)):
        code = await generate_code(db, cfg.entity_code)
        return await crud.create(db, payload, project_id=project_id, **{cfg.code_field: code}, **cfg.default_values)

    @router.get("/{item_id}", response_model=cfg.read_schema)
    async def get_item(project_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
        obj = await crud.get(db, item_id)
        if obj is None or obj.project_id != project_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        return obj

    @router.put("/{item_id}", response_model=cfg.read_schema, dependencies=_pm_write)
    async def update_item(
        project_id: UUID, item_id: UUID, payload: cfg.update_schema, db: AsyncSession = Depends(get_db)
    ):
        obj = await crud.get(db, item_id)
        if obj is None or obj.project_id != project_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        return await crud.update(db, obj, payload)

    @router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_pm_write)
    async def delete_item(project_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
        obj = await crud.get(db, item_id)
        if obj is None or obj.project_id != project_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        await crud.delete(db, obj)

    return router


router = APIRouter()

router.include_router(
    build_raid_router(
        RaidConfig(
            prefix="risks",
            tag="Risk Log",
            model=RiskLog,
            crud=risk_log_crud,
            create_schema=RiskLogCreate,
            update_schema=RiskLogUpdate,
            read_schema=RiskLogRead,
            entity_code="RISK",
            code_field="risk_code",
            title_field="risk_title",
            status_field="current_status",
            category_field="risk_category",
            owner_field="risk_owner",
            default_values={"current_status": "Open"},
        )
    )
)
router.include_router(
    build_raid_router(
        RaidConfig(
            prefix="issues",
            tag="Issue Log",
            model=IssueLog,
            crud=issue_log_crud,
            create_schema=IssueLogCreate,
            update_schema=IssueLogUpdate,
            read_schema=IssueLogRead,
            entity_code="ISSUE",
            code_field="issue_code",
            title_field="issue_title",
            status_field="status",
            category_field="issue_category",
            owner_field="assigned_to",
            default_values={"status": "New"},
        )
    )
)
router.include_router(
    build_raid_router(
        RaidConfig(
            prefix="dependencies",
            tag="Dependency Log",
            model=DependencyLog,
            crud=dependency_log_crud,
            create_schema=DependencyLogCreate,
            update_schema=DependencyLogUpdate,
            read_schema=DependencyLogRead,
            entity_code="DEPENDENCY",
            code_field="dependency_code",
            title_field="dependency_title",
            status_field="dependency_status",
            category_field="category",
            owner_field="owner",
            default_values={"dependency_status": "Not Started"},
        )
    )
)
router.include_router(
    build_raid_router(
        RaidConfig(
            prefix="assumptions",
            tag="Assumption Log",
            model=AssumptionLog,
            crud=assumption_log_crud,
            create_schema=AssumptionLogCreate,
            update_schema=AssumptionLogUpdate,
            read_schema=AssumptionLogRead,
            entity_code="ASSUMPTION",
            code_field="assumption_code",
            title_field="title",
            status_field="current_status",
            category_field="category",
            owner_field="owner",
            default_values={"validation_status": "Pending", "current_status": "Open"},
            has_review_dates=False,  # uses validation_date instead (one-time, not recurring)
        )
    )
)
router.include_router(
    build_raid_router(
        RaidConfig(
            prefix="opportunities",
            tag="Opportunity Log",
            model=OpportunityLog,
            crud=opportunity_log_crud,
            create_schema=OpportunityLogCreate,
            update_schema=OpportunityLogUpdate,
            read_schema=OpportunityLogRead,
            entity_code="OPPORTUNITY",
            code_field="opportunity_code",
            title_field="opportunity_title",
            status_field="status",
            category_field="category",
            owner_field="opportunity_owner",
            default_values={"status": "Identified"},
        )
    )
)
