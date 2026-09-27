"""Oracle projects vs. governance projects (Project Health -> Oracle Projects).

`oracle_project_master` holds every project Oracle's man-month report has
listed. An Oracle project is *mapped* once any governance project carries its
number in `project_oracle_ids`; the rest have no governance project yet and are
what Geo Heads / Delivery Managers need to chase.

Role scoping (see OracleProjectScope):
* Geo Head - Oracle projects in a geo they own, plus those with no GEO resolved;
* Delivery Manager (Account Head) - Oracle projects whose Oracle account is one of theirs;
* Admin / PMO / CDO / Delivery Excellence - everything.
"""

from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from sqlalchemy import and_, case, exists, false, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.oracle_man_month import OracleProjectMaster as OPM
from app.models.projects import Project, ProjectOracleId
from app.models.reference_data import Geo, Region
from app.schemas.oracle_project_mapping import OracleProjectRow, OracleProjectSummary

MappingStatus = Literal["unmapped", "mapped", "all"]


@dataclass
class OracleProjectScope:
    # Role scope. None = not restricted on that axis.
    owned_geo_ids: list[UUID] | None = None  # Geo Head (also sees projects with no GEO)
    owned_account_names: list[str] | None = None  # Delivery Manager; lower-cased account names
    # Filter-bar narrowing, applied on top of the role scope.
    geo_id: UUID | None = None
    region_id: UUID | None = None
    account_name: str | None = None  # lower-cased


def _is_mapped():
    return exists().where(ProjectOracleId.oracle_project_id == OPM.project_number)


def _conditions(scope: OracleProjectScope) -> list:
    conditions = []
    if scope.owned_geo_ids is not None:
        conditions.append(or_(OPM.geo_id.in_(scope.owned_geo_ids), OPM.geo_id.is_(None)))
    if scope.owned_account_names is not None:
        conditions.append(
            func.lower(func.trim(OPM.account_name)).in_(scope.owned_account_names)
            if scope.owned_account_names
            else false()
        )
    if scope.geo_id is not None:
        # A Geo Head's own geo is preselected in the filter bar; the projects with
        # no GEO are theirs to chase too, so choosing a geo doesn't hide them.
        conditions.append(
            or_(OPM.geo_id == scope.geo_id, OPM.geo_id.is_(None))
            if scope.owned_geo_ids is not None
            else OPM.geo_id == scope.geo_id
        )
    if scope.region_id is not None:
        conditions.append(OPM.region_id == scope.region_id)
    if scope.account_name is not None:
        conditions.append(func.lower(func.trim(OPM.account_name)) == scope.account_name)
    return conditions


async def oracle_project_summary(db: AsyncSession, scope: OracleProjectScope) -> OracleProjectSummary:
    mapped = _is_mapped()
    row = (
        await db.execute(
            select(
                func.coalesce(func.sum(case((mapped, 1), else_=0)), 0),
                func.coalesce(func.sum(case((~mapped, 1), else_=0)), 0),
                func.coalesce(func.sum(case((and_(~mapped, OPM.geo_id.is_(None)), 1), else_=0)), 0),
            ).where(*_conditions(scope))
        )
    ).one()
    return OracleProjectSummary(
        mapped_count=int(row[0]), unmapped_count=int(row[1]), unmapped_no_geo_count=int(row[2])
    )


async def list_oracle_projects(
    db: AsyncSession,
    scope: OracleProjectScope,
    *,
    status: MappingStatus = "unmapped",
    search: str | None = None,
    skip: int = 0,
    limit: int = 10,
) -> tuple[list[OracleProjectRow], int]:
    mapped = _is_mapped()
    conditions = _conditions(scope)
    if status == "unmapped":
        conditions.append(~mapped)
    elif status == "mapped":
        conditions.append(mapped)
    if search and search.strip():
        pattern = f"%{search.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(OPM.project_number).like(pattern),
                func.lower(OPM.project_name).like(pattern),
                func.lower(func.coalesce(OPM.account_name, "")).like(pattern),
            )
        )

    total = (await db.execute(select(func.count()).select_from(OPM).where(*conditions))).scalar_one()

    governance_code = (
        select(func.min(Project.project_code))
        .select_from(ProjectOracleId)
        .join(Project, Project.id == ProjectOracleId.project_id)
        .where(ProjectOracleId.oracle_project_id == OPM.project_number)
        .correlate(OPM)
        .scalar_subquery()
    )
    rows = (
        await db.execute(
            select(OPM, Geo.name, Region.name, mapped.label("mapped"), governance_code.label("governance_code"))
            .outerjoin(Geo, Geo.id == OPM.geo_id)
            .outerjoin(Region, Region.id == OPM.region_id)
            .where(*conditions)
            .order_by(OPM.project_number)
            .offset(skip)
            .limit(limit)
        )
    ).all()

    items = [
        OracleProjectRow(
            oracle_project_id=project.id,
            project_number=project.project_number,
            project_name=project.project_name,
            account_name=project.account_name,
            project_type=project.project_type,
            project_ou=project.project_ou,
            project_geo=project.project_geo,
            geo_name=geo_name,
            region_name=region_name,
            start_date=project.project_start_date,
            end_date=project.project_end_date,
            last_seen_month=project.last_seen_month,
            mapped=bool(is_mapped),
            governance_project_code=code,
        )
        for project, geo_name, region_name, is_mapped, code in rows
    ]
    return items, total
