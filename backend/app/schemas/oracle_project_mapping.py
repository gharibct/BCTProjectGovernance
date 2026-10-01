from datetime import date
from uuid import UUID

from pydantic import BaseModel


class OracleProjectSummary(BaseModel):
    """Oracle projects in the caller's scope, split by whether any governance
    project has been created for them."""

    mapped_count: int
    unmapped_count: int
    # Subset of unmapped_count with no GEO resolved from Project Geo.
    unmapped_no_geo_count: int


class OracleProjectDemographyEntry(BaseModel):
    # GovOne project type name + description; None groups projects with no type set.
    project_type: str | None
    description: str | None = None
    count: int


class OracleProjectRow(BaseModel):
    oracle_project_id: UUID
    project_number: str
    project_name: str
    account_name: str | None
    project_type: str | None
    project_ou: str | None
    # Raw Oracle "Project Geo" (e.g. "BCT US") and the GEO / Region it resolved to.
    project_geo: str | None
    geo_name: str | None
    region_name: str | None
    start_date: date | None
    end_date: date | None
    last_seen_month: date
    mapped: bool
    # A governance project this Oracle project is mapped to (lowest code when several).
    governance_project_code: str | None
