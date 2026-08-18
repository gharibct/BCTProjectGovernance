"""Measurement Entry (UX §4.10), one tab per Project Type. Support, Testing,
Cloud Maintenance and Cloud Migration share a flat (project_id, period_id,
raw inputs -> computed metrics) shape and go through build_measurement_router.
Development and Staffing additionally have a nested child table (per-SDLC-stage
defects, per-priority response/lead time) so they get bespoke routers below.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, pagination_params, require_role
from app.core.db import get_db
from app.crud.base import CRUDBase
from app.crud.measurement import (
    measurement_cloud_maintenance_crud,
    measurement_cloud_migration_crud,
    measurement_development_crud,
    measurement_staffing_crud,
    measurement_support_crud,
    measurement_testing_crud,
)
from app.models.measurement import (
    MeasurementCloudMaintenance,
    MeasurementCloudMigration,
    MeasurementDevelopment,
    MeasurementDevelopmentDefect,
    MeasurementStaffing,
    MeasurementStaffingPriorityMetric,
    MeasurementSupport,
    MeasurementTesting,
)
from app.models.reference_data import ReportingPeriod
from app.schemas.common import Page
from app.schemas.enums import RoleCode, SdlcStage, StaffingPriority
from app.schemas.measurement import (
    MeasurementCloudMaintenanceCreate,
    MeasurementCloudMaintenanceRead,
    MeasurementCloudMigrationCreate,
    MeasurementCloudMigrationRead,
    MeasurementDevelopmentCreate,
    MeasurementDevelopmentDefectIn,
    MeasurementDevelopmentDefectRead,
    MeasurementDevelopmentRead,
    MeasurementDevelopmentReadWithDefects,
    MeasurementDevelopmentUpdate,
    MeasurementStaffingCreate,
    MeasurementStaffingPriorityMetricIn,
    MeasurementStaffingPriorityMetricRead,
    MeasurementStaffingRead,
    MeasurementStaffingReadWithPriorities,
    MeasurementStaffingUpdate,
    MeasurementSupportCreate,
    MeasurementSupportRead,
    MeasurementTestingCreate,
    MeasurementTestingRead,
)
from app.services.measurement_metrics import (
    compute_cloud_maintenance_metrics,
    compute_cloud_migration_metrics,
    compute_defect_leakage_pct,
    compute_development_metrics,
    compute_staffing_metrics,
    compute_staffing_priority_trailing_averages,
    compute_support_metrics,
    compute_testing_metrics,
)

router = APIRouter()

_pm_write = [Depends(require_role(RoleCode.PROJECT_MANAGER, RoleCode.ADMIN))]


# Most Measurement tabs key their snapshots off a reporting_periods row rather
# than a raw date (see db/tables/11-15), so "latest"/list ordering has to sort
# by that period's start_date via a correlated subquery. Cloud Migration is
# event-based (multiple attempts can land on the same day) and still orders by
# its own as_of_date column.
def _by_period_start(model: type) -> Any:
    return (
        select(ReportingPeriod.start_date).where(ReportingPeriod.id == model.period_id).scalar_subquery().desc()
    )


def _by_as_of_date(model: type) -> Any:
    return model.as_of_date.desc()


# --- Generic factory for the 4 flat tabs ---


@dataclass
class MeasurementConfig:
    prefix: str
    tag: str
    model: type
    crud: CRUDBase
    create_schema: type
    update_schema: type
    read_schema: type
    compute_metrics: Callable[[dict], dict]
    order_by: Callable[[type], Any]


def build_measurement_router(cfg: MeasurementConfig) -> APIRouter:
    sub = APIRouter(prefix=f"/projects/{{project_id}}/measurements/{cfg.prefix}", tags=[cfg.tag])
    model = cfg.model
    crud = cfg.crud

    @sub.get("", response_model=Page[cfg.read_schema])
    async def list_items(
        project_id: UUID,
        pagination: PaginationParams = Depends(pagination_params),
        db: AsyncSession = Depends(get_db),
    ):
        items, total = await crud.list(
            db,
            skip=pagination.skip,
            limit=pagination.limit,
            filters={model.project_id: project_id},
            order_by=cfg.order_by(model),
        )
        return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)

    @sub.get("/latest", response_model=cfg.read_schema)
    async def get_latest(project_id: UUID, db: AsyncSession = Depends(get_db)):
        items, _ = await crud.list(
            db, filters={model.project_id: project_id}, order_by=cfg.order_by(model), limit=1
        )
        if not items:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No measurement data recorded for this project")
        return items[0]

    @sub.post("", response_model=cfg.read_schema, status_code=status.HTTP_201_CREATED, dependencies=_pm_write)
    async def create_item(project_id: UUID, payload: cfg.create_schema, db: AsyncSession = Depends(get_db)):
        metrics = cfg.compute_metrics(payload.model_dump())
        return await crud.create(db, payload, project_id=project_id, **metrics)

    @sub.get("/{item_id}", response_model=cfg.read_schema)
    async def get_item(project_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
        obj = await crud.get(db, item_id)
        if obj is None or obj.project_id != project_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        return obj

    @sub.put("/{item_id}", response_model=cfg.read_schema, dependencies=_pm_write)
    async def update_item(
        project_id: UUID, item_id: UUID, payload: cfg.update_schema, db: AsyncSession = Depends(get_db)
    ):
        obj = await crud.get(db, item_id)
        if obj is None or obj.project_id != project_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        obj = await crud.update(db, obj, payload)
        merged = {c.name: getattr(obj, c.name) for c in model.__table__.columns}
        for key, value in cfg.compute_metrics(merged).items():
            setattr(obj, key, value)
        await db.flush()
        return obj

    @sub.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_pm_write)
    async def delete_item(project_id: UUID, item_id: UUID, db: AsyncSession = Depends(get_db)):
        obj = await crud.get(db, item_id)
        if obj is None or obj.project_id != project_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        await crud.delete(db, obj)

    return sub


router.include_router(
    build_measurement_router(
        MeasurementConfig(
            prefix="support",
            tag="Measurement - Support",
            model=MeasurementSupport,
            crud=measurement_support_crud,
            create_schema=MeasurementSupportCreate,
            update_schema=MeasurementSupportCreate,
            read_schema=MeasurementSupportRead,
            compute_metrics=compute_support_metrics,
            order_by=_by_period_start,
        )
    )
)
router.include_router(
    build_measurement_router(
        MeasurementConfig(
            prefix="testing",
            tag="Measurement - Testing",
            model=MeasurementTesting,
            crud=measurement_testing_crud,
            create_schema=MeasurementTestingCreate,
            update_schema=MeasurementTestingCreate,
            read_schema=MeasurementTestingRead,
            compute_metrics=compute_testing_metrics,
            order_by=_by_period_start,
        )
    )
)
router.include_router(
    build_measurement_router(
        MeasurementConfig(
            prefix="cloud-maintenance",
            tag="Measurement - Cloud Maintenance",
            model=MeasurementCloudMaintenance,
            crud=measurement_cloud_maintenance_crud,
            create_schema=MeasurementCloudMaintenanceCreate,
            update_schema=MeasurementCloudMaintenanceCreate,
            read_schema=MeasurementCloudMaintenanceRead,
            compute_metrics=compute_cloud_maintenance_metrics,
            order_by=_by_period_start,
        )
    )
)
router.include_router(
    build_measurement_router(
        MeasurementConfig(
            prefix="cloud-migration",
            tag="Measurement - Cloud Migration",
            model=MeasurementCloudMigration,
            crud=measurement_cloud_migration_crud,
            create_schema=MeasurementCloudMigrationCreate,
            update_schema=MeasurementCloudMigrationCreate,
            read_schema=MeasurementCloudMigrationRead,
            compute_metrics=compute_cloud_migration_metrics,
            order_by=_by_as_of_date,
        )
    )
)


# --- Development (bespoke: per-SDLC-stage defect rows) ---

dev_router = APIRouter(prefix="/projects/{project_id}/measurements/development", tags=["Measurement - Development"])


async def _load_development_with_defects(db: AsyncSession, measurement: MeasurementDevelopment):
    stmt = select(MeasurementDevelopmentDefect).where(MeasurementDevelopmentDefect.measurement_id == measurement.id)
    defects = (await db.execute(stmt)).scalars().all()
    return MeasurementDevelopmentReadWithDefects(
        **MeasurementDevelopmentRead.model_validate(measurement).model_dump(),
        defects_by_stage=[MeasurementDevelopmentDefectRead.model_validate(d) for d in defects],
    )


def _recompute_defect_leakage(measurement: MeasurementDevelopment, defects: list[MeasurementDevelopmentDefect]) -> None:
    total_internal = sum(d.internal_defects for d in defects)
    total_external = (
        sum(d.external_defects for d in defects)
        + (measurement.uat_defects_external or 0)
        + (measurement.production_defects_external or 0)
    )
    measurement.defect_leakage_pct = compute_defect_leakage_pct(total_internal, total_external)


@dev_router.get("", response_model=Page[MeasurementDevelopmentRead])
async def list_development(
    project_id: UUID,
    pagination: PaginationParams = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    items, total = await measurement_development_crud.list(
        db,
        skip=pagination.skip,
        limit=pagination.limit,
        filters={MeasurementDevelopment.project_id: project_id},
        order_by=_by_period_start(MeasurementDevelopment),
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@dev_router.get("/latest", response_model=MeasurementDevelopmentReadWithDefects)
async def get_latest_development(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await measurement_development_crud.list(
        db,
        filters={MeasurementDevelopment.project_id: project_id},
        order_by=_by_period_start(MeasurementDevelopment),
        limit=1,
    )
    if not items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No development measurement data recorded for this project")
    return await _load_development_with_defects(db, items[0])


@dev_router.post(
    "", response_model=MeasurementDevelopmentReadWithDefects, status_code=status.HTTP_201_CREATED, dependencies=_pm_write
)
async def create_development(project_id: UUID, payload: MeasurementDevelopmentCreate, db: AsyncSession = Depends(get_db)):
    data = payload.model_dump(exclude={"defects_by_stage"})
    metrics = compute_development_metrics(data)

    now = datetime.now(UTC)
    measurement = MeasurementDevelopment(id=uuid4(), project_id=project_id, created_at=now, updated_at=now, **data, **metrics)
    db.add(measurement)
    await db.flush()

    defect_rows = [
        MeasurementDevelopmentDefect(id=uuid4(), measurement_id=measurement.id, **defect.model_dump())
        for defect in payload.defects_by_stage
    ]
    db.add_all(defect_rows)
    await db.flush()

    _recompute_defect_leakage(measurement, defect_rows)
    await db.flush()
    await db.refresh(measurement)

    return await _load_development_with_defects(db, measurement)


@dev_router.get("/{measurement_id}", response_model=MeasurementDevelopmentReadWithDefects)
async def get_development(project_id: UUID, measurement_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await measurement_development_crud.get(db, measurement_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return await _load_development_with_defects(db, obj)


@dev_router.put("/{measurement_id}", response_model=MeasurementDevelopmentReadWithDefects, dependencies=_pm_write)
async def update_development(
    project_id: UUID,
    measurement_id: UUID,
    payload: MeasurementDevelopmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await measurement_development_crud.get(db, measurement_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    obj = await measurement_development_crud.update(db, obj, payload)

    merged = {c.name: getattr(obj, c.name) for c in MeasurementDevelopment.__table__.columns}
    for key, value in compute_development_metrics(merged).items():
        setattr(obj, key, value)

    stmt = select(MeasurementDevelopmentDefect).where(MeasurementDevelopmentDefect.measurement_id == obj.id)
    defects = (await db.execute(stmt)).scalars().all()
    _recompute_defect_leakage(obj, defects)
    await db.flush()

    return await _load_development_with_defects(db, obj)


@dev_router.delete("/{measurement_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_pm_write)
async def delete_development(project_id: UUID, measurement_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await measurement_development_crud.get(db, measurement_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    await measurement_development_crud.delete(db, obj)


@dev_router.put(
    "/{measurement_id}/defects/{sdlc_stage}", response_model=MeasurementDevelopmentDefectRead, dependencies=_pm_write
)
async def upsert_defect(
    project_id: UUID,
    measurement_id: UUID,
    sdlc_stage: SdlcStage,
    payload: MeasurementDevelopmentDefectIn,
    db: AsyncSession = Depends(get_db),
):
    measurement = await measurement_development_crud.get(db, measurement_id)
    if measurement is None or measurement.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Measurement not found")

    stmt = select(MeasurementDevelopmentDefect).where(
        MeasurementDevelopmentDefect.measurement_id == measurement_id,
        MeasurementDevelopmentDefect.sdlc_stage == sdlc_stage,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing is None:
        existing = MeasurementDevelopmentDefect(id=uuid4(), measurement_id=measurement_id, sdlc_stage=sdlc_stage)
        db.add(existing)
    existing.internal_defects = payload.internal_defects
    existing.external_defects = payload.external_defects
    await db.flush()

    stmt = select(MeasurementDevelopmentDefect).where(MeasurementDevelopmentDefect.measurement_id == measurement_id)
    defects = (await db.execute(stmt)).scalars().all()
    _recompute_defect_leakage(measurement, defects)
    await db.flush()
    await db.refresh(existing)
    return existing


# --- Staffing (bespoke: per-priority response/lead time rows) ---

staffing_router = APIRouter(prefix="/projects/{project_id}/measurements/staffing", tags=["Measurement - Staffing"])


async def _load_staffing_with_priorities(db: AsyncSession, measurement: MeasurementStaffing):
    stmt = select(MeasurementStaffingPriorityMetric).where(
        MeasurementStaffingPriorityMetric.measurement_id == measurement.id
    )
    rows = (await db.execute(stmt)).scalars().all()
    return MeasurementStaffingReadWithPriorities(
        **MeasurementStaffingRead.model_validate(measurement).model_dump(),
        priority_metrics=[MeasurementStaffingPriorityMetricRead.model_validate(r) for r in rows],
    )


@staffing_router.get("", response_model=Page[MeasurementStaffingRead])
async def list_staffing(
    project_id: UUID,
    pagination: PaginationParams = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    items, total = await measurement_staffing_crud.list(
        db,
        skip=pagination.skip,
        limit=pagination.limit,
        filters={MeasurementStaffing.project_id: project_id},
        order_by=_by_period_start(MeasurementStaffing),
    )
    return Page(items=items, total=total, skip=pagination.skip, limit=pagination.limit)


@staffing_router.get("/latest", response_model=MeasurementStaffingReadWithPriorities)
async def get_latest_staffing(project_id: UUID, db: AsyncSession = Depends(get_db)):
    items, _ = await measurement_staffing_crud.list(
        db,
        filters={MeasurementStaffing.project_id: project_id},
        order_by=_by_period_start(MeasurementStaffing),
        limit=1,
    )
    if not items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No staffing measurement data recorded for this project")
    return await _load_staffing_with_priorities(db, items[0])


@staffing_router.post(
    "", response_model=MeasurementStaffingReadWithPriorities, status_code=status.HTTP_201_CREATED, dependencies=_pm_write
)
async def create_staffing(project_id: UUID, payload: MeasurementStaffingCreate, db: AsyncSession = Depends(get_db)):
    data = payload.model_dump(exclude={"priority_metrics"})
    metrics = compute_staffing_metrics(data)

    now = datetime.now(UTC)
    measurement = MeasurementStaffing(id=uuid4(), project_id=project_id, created_at=now, updated_at=now, **data, **metrics)
    db.add(measurement)
    await db.flush()

    priority_rows = []
    for priority_in in payload.priority_metrics:
        # Trailing average is computed from prior periods only, since this
        # period's row isn't committed yet at this point.
        trailing = await compute_staffing_priority_trailing_averages(db, project_id, priority_in.priority)
        priority_rows.append(
            MeasurementStaffingPriorityMetric(
                id=uuid4(),
                measurement_id=measurement.id,
                priority=priority_in.priority,
                response_time_hours=priority_in.response_time_hours,
                lead_time_days=priority_in.lead_time_days,
                **trailing,
            )
        )
    db.add_all(priority_rows)
    await db.flush()
    await db.refresh(measurement)

    return await _load_staffing_with_priorities(db, measurement)


@staffing_router.get("/{measurement_id}", response_model=MeasurementStaffingReadWithPriorities)
async def get_staffing(project_id: UUID, measurement_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await measurement_staffing_crud.get(db, measurement_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return await _load_staffing_with_priorities(db, obj)


@staffing_router.put("/{measurement_id}", response_model=MeasurementStaffingReadWithPriorities, dependencies=_pm_write)
async def update_staffing(
    project_id: UUID,
    measurement_id: UUID,
    payload: MeasurementStaffingUpdate,
    db: AsyncSession = Depends(get_db),
):
    obj = await measurement_staffing_crud.get(db, measurement_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    obj = await measurement_staffing_crud.update(db, obj, payload)

    merged = {c.name: getattr(obj, c.name) for c in MeasurementStaffing.__table__.columns}
    for key, value in compute_staffing_metrics(merged).items():
        setattr(obj, key, value)
    await db.flush()

    return await _load_staffing_with_priorities(db, obj)


@staffing_router.delete("/{measurement_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_pm_write)
async def delete_staffing(project_id: UUID, measurement_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await measurement_staffing_crud.get(db, measurement_id)
    if obj is None or obj.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    await measurement_staffing_crud.delete(db, obj)


@staffing_router.put(
    "/{measurement_id}/priorities/{priority}",
    response_model=MeasurementStaffingPriorityMetricRead,
    dependencies=_pm_write,
)
async def upsert_priority_metric(
    project_id: UUID,
    measurement_id: UUID,
    priority: StaffingPriority,
    payload: MeasurementStaffingPriorityMetricIn,
    db: AsyncSession = Depends(get_db),
):
    measurement = await measurement_staffing_crud.get(db, measurement_id)
    if measurement is None or measurement.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Measurement not found")

    stmt = select(MeasurementStaffingPriorityMetric).where(
        MeasurementStaffingPriorityMetric.measurement_id == measurement_id,
        MeasurementStaffingPriorityMetric.priority == priority,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    trailing = await compute_staffing_priority_trailing_averages(db, project_id, priority)
    if existing is None:
        existing = MeasurementStaffingPriorityMetric(id=uuid4(), measurement_id=measurement_id, priority=priority)
        db.add(existing)
    existing.response_time_hours = payload.response_time_hours
    existing.lead_time_days = payload.lead_time_days
    existing.avg_response_time_hours = trailing["avg_response_time_hours"]
    existing.avg_lead_time_days = trailing["avg_lead_time_days"]
    await db.flush()
    await db.refresh(existing)
    return existing


router.include_router(dev_router)
router.include_router(staffing_router)
