"""Metric Targets (UX §4.10 "Target ... Metrics" tiles), one per Project Type.
Unlike Measurement Entry, these are a single row per project (no reporting
period — see db/tables/24-29_metric_target_*.sql), so the API is a
get-or-404 / upsert pair keyed by project_id rather than a list/create
resource keyed by its own id. Development, Support, Testing, Cloud
Maintenance and Cloud Migration share that flat shape and go through
build_metric_target_router. Staffing additionally has a per-priority child
table, so it gets a bespoke router below.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.metric_target import (
    MetricTargetCloudMaintenance,
    MetricTargetCloudMigration,
    MetricTargetDevelopment,
    MetricTargetStaffing,
    MetricTargetStaffingPriority,
    MetricTargetSupport,
    MetricTargetTesting,
)
from app.schemas.enums import StaffingPriority
from app.schemas.metric_target import (
    MetricTargetCloudMaintenanceIn,
    MetricTargetCloudMaintenanceRead,
    MetricTargetCloudMigrationIn,
    MetricTargetCloudMigrationRead,
    MetricTargetDevelopmentIn,
    MetricTargetDevelopmentRead,
    MetricTargetStaffingIn,
    MetricTargetStaffingPriorityIn,
    MetricTargetStaffingPriorityRead,
    MetricTargetStaffingRead,
    MetricTargetSupportIn,
    MetricTargetSupportRead,
    MetricTargetTestingIn,
    MetricTargetTestingRead,
)

router = APIRouter()


# --- Generic factory for the 5 single-row targets ---


@dataclass
class MetricTargetConfig:
    prefix: str
    tag: str
    model: type
    in_schema: type
    read_schema: type


def build_metric_target_router(cfg: MetricTargetConfig) -> APIRouter:
    sub = APIRouter(prefix=f"/projects/{{project_id}}/metric-targets/{cfg.prefix}", tags=[cfg.tag])
    model = cfg.model

    async def _get(db: AsyncSession, project_id: UUID):
        stmt = select(model).where(model.project_id == project_id)
        return (await db.execute(stmt)).scalar_one_or_none()

    @sub.get("", response_model=cfg.read_schema)
    async def get_target(project_id: UUID, db: AsyncSession = Depends(get_db)):
        obj = await _get(db, project_id)
        if obj is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No targets set for this project")
        return obj

    @sub.put("", response_model=cfg.read_schema)
    async def upsert_target(project_id: UUID, payload: cfg.in_schema, db: AsyncSession = Depends(get_db)):
        now = datetime.now(UTC)
        obj = await _get(db, project_id)
        if obj is None:
            obj = model(id=uuid4(), project_id=project_id, created_at=now, updated_at=now, **payload.model_dump())
            db.add(obj)
        else:
            for key, value in payload.model_dump().items():
                setattr(obj, key, value)
            obj.updated_at = now
        await db.flush()
        await db.refresh(obj)
        return obj

    @sub.delete("", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_target(project_id: UUID, db: AsyncSession = Depends(get_db)):
        obj = await _get(db, project_id)
        if obj is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No targets set for this project")
        await db.delete(obj)
        await db.flush()

    return sub


router.include_router(
    build_metric_target_router(
        MetricTargetConfig(
            prefix="development",
            tag="Metric Target - Development",
            model=MetricTargetDevelopment,
            in_schema=MetricTargetDevelopmentIn,
            read_schema=MetricTargetDevelopmentRead,
        )
    )
)
router.include_router(
    build_metric_target_router(
        MetricTargetConfig(
            prefix="support",
            tag="Metric Target - Support",
            model=MetricTargetSupport,
            in_schema=MetricTargetSupportIn,
            read_schema=MetricTargetSupportRead,
        )
    )
)
router.include_router(
    build_metric_target_router(
        MetricTargetConfig(
            prefix="testing",
            tag="Metric Target - Testing",
            model=MetricTargetTesting,
            in_schema=MetricTargetTestingIn,
            read_schema=MetricTargetTestingRead,
        )
    )
)
router.include_router(
    build_metric_target_router(
        MetricTargetConfig(
            prefix="cloud-maintenance",
            tag="Metric Target - Cloud Maintenance",
            model=MetricTargetCloudMaintenance,
            in_schema=MetricTargetCloudMaintenanceIn,
            read_schema=MetricTargetCloudMaintenanceRead,
        )
    )
)
router.include_router(
    build_metric_target_router(
        MetricTargetConfig(
            prefix="cloud-migration",
            tag="Metric Target - Cloud Migration",
            model=MetricTargetCloudMigration,
            in_schema=MetricTargetCloudMigrationIn,
            read_schema=MetricTargetCloudMigrationRead,
        )
    )
)


# --- Staffing (bespoke: per-priority target rows) ---

staffing_router = APIRouter(prefix="/projects/{project_id}/metric-targets/staffing", tags=["Metric Target - Staffing"])


async def _get_staffing_target(db: AsyncSession, project_id: UUID) -> MetricTargetStaffing | None:
    stmt = select(MetricTargetStaffing).where(MetricTargetStaffing.project_id == project_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def _load_staffing_target_with_priorities(db: AsyncSession, target: MetricTargetStaffing) -> MetricTargetStaffingRead:
    stmt = select(MetricTargetStaffingPriority).where(MetricTargetStaffingPriority.metric_target_id == target.id)
    rows = (await db.execute(stmt)).scalars().all()
    return MetricTargetStaffingRead(
        id=target.id,
        project_id=target.project_id,
        target_pct_profiles_qualifying=target.target_pct_profiles_qualifying,
        target_pct_candidates_joining=target.target_pct_candidates_joining,
        priority_targets=[MetricTargetStaffingPriorityRead.model_validate(r) for r in rows],
    )


@staffing_router.get("", response_model=MetricTargetStaffingRead)
async def get_staffing_target(project_id: UUID, db: AsyncSession = Depends(get_db)):
    target = await _get_staffing_target(db, project_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No staffing targets set for this project")
    return await _load_staffing_target_with_priorities(db, target)


@staffing_router.put("", response_model=MetricTargetStaffingRead)
async def upsert_staffing_target(project_id: UUID, payload: MetricTargetStaffingIn, db: AsyncSession = Depends(get_db)):
    now = datetime.now(UTC)
    target = await _get_staffing_target(db, project_id)
    if target is None:
        target = MetricTargetStaffing(
            id=uuid4(),
            project_id=project_id,
            created_at=now,
            updated_at=now,
            target_pct_profiles_qualifying=payload.target_pct_profiles_qualifying,
            target_pct_candidates_joining=payload.target_pct_candidates_joining,
        )
        db.add(target)
    else:
        target.target_pct_profiles_qualifying = payload.target_pct_profiles_qualifying
        target.target_pct_candidates_joining = payload.target_pct_candidates_joining
        target.updated_at = now
    await db.flush()

    for priority_in in payload.priority_targets:
        stmt = select(MetricTargetStaffingPriority).where(
            MetricTargetStaffingPriority.metric_target_id == target.id,
            MetricTargetStaffingPriority.priority == priority_in.priority,
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing is None:
            existing = MetricTargetStaffingPriority(id=uuid4(), metric_target_id=target.id, priority=priority_in.priority)
            db.add(existing)
        existing.target_avg_response_time_hours = priority_in.target_avg_response_time_hours
        existing.target_avg_lead_time_days = priority_in.target_avg_lead_time_days
    await db.flush()
    await db.refresh(target)

    return await _load_staffing_target_with_priorities(db, target)


@staffing_router.put("/priorities/{priority}", response_model=MetricTargetStaffingPriorityRead)
async def upsert_staffing_priority_target(
    project_id: UUID,
    priority: StaffingPriority,
    payload: MetricTargetStaffingPriorityIn,
    db: AsyncSession = Depends(get_db),
):
    target = await _get_staffing_target(db, project_id)
    if target is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "No staffing targets set for this project yet; PUT the parent resource first"
        )

    stmt = select(MetricTargetStaffingPriority).where(
        MetricTargetStaffingPriority.metric_target_id == target.id,
        MetricTargetStaffingPriority.priority == priority,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing is None:
        existing = MetricTargetStaffingPriority(id=uuid4(), metric_target_id=target.id, priority=priority)
        db.add(existing)
    existing.target_avg_response_time_hours = payload.target_avg_response_time_hours
    existing.target_avg_lead_time_days = payload.target_avg_lead_time_days
    await db.flush()
    await db.refresh(existing)
    return existing


@staffing_router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staffing_target(project_id: UUID, db: AsyncSession = Depends(get_db)):
    target = await _get_staffing_target(db, project_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No staffing targets set for this project")
    await db.delete(target)
    await db.flush()


router.include_router(staffing_router)
