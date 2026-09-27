"""Project profile (Organization / Region / GEO / Account) derived from an Oracle project.

The Create Project screen calls this when the first Oracle Project ID is added,
so the requester doesn't re-key what Oracle already knows. Everything comes from
`oracle_project_master` (see services/man_month_import.py):

* Organization - BCTPL for every project.
* Region - Oracle's `project_geo` is "BCT " + region ("BCT US", "BCT OMAN"); a few
  rows drop the prefix ("BRUNEI") or use "BCTC " ("BCTC UK"). The prefix is
  stripped and the rest matched to an active region's code or name.
* GEO - the resolved region's geo.
* Account - `account_name`, matched to an account by name.

Anything that can't be resolved comes back as None (with a note) rather than
failing, so the requester can pick it by hand.
"""

from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.oracle_man_month import OracleProjectMaster
from app.models.reference_data import Account, Geo, Organization, Region

ORGANIZATION_CODE = "BCTPL"

# Longest first, so "BCTC UK" isn't read as "BCT" + "C UK".
_GEO_PREFIXES = ("BCTC ", "BCT ")


def region_token(project_geo: str | None) -> str | None:
    """"BCT US" -> "US"; "BRUNEI" -> "BRUNEI"; blank -> None."""
    if project_geo is None:
        return None
    token = " ".join(project_geo.split()).upper()
    for prefix in _GEO_PREFIXES:
        if token.startswith(prefix):
            token = token[len(prefix) :]
            break
    return token or None


async def load_active_regions(db: AsyncSession) -> list[Region]:
    """Active regions under an active GEO — the candidates a project geo can resolve to."""
    return list(
        (
            await db.execute(
                select(Region)
                .join(Geo, Geo.id == Region.geo_id)
                .where(Region.is_active.is_(True), Geo.is_active.is_(True))
            )
        )
        .scalars()
        .all()
    )


def match_region(project_geo: str | None, regions: list[Region]) -> list[Region]:
    """Regions whose code or name equals the project geo's region token ("BCT US" -> US)."""
    token = region_token(project_geo)
    if token is None:
        return []
    return [r for r in regions if token in (r.code.strip().upper(), r.name.strip().upper())]


async def oracle_project_descriptions(db: AsyncSession, project_numbers: list[str]) -> dict[str, str]:
    """Oracle project number -> project name (the "description"), for the numbers found in the master."""
    if not project_numbers:
        return {}
    rows = await db.execute(
        select(OracleProjectMaster.project_number, OracleProjectMaster.project_name).where(
            OracleProjectMaster.project_number.in_(project_numbers)
        )
    )
    return dict(rows.all())


@dataclass
class OracleProjectProfile:
    found: bool
    oracle_project_id: str
    oracle_project_name: str | None = None
    oracle_project_geo: str | None = None
    oracle_account_name: str | None = None
    organization_id: UUID | None = None
    geo_id: UUID | None = None
    region_id: UUID | None = None
    account_id: UUID | None = None
    notes: list[str] = field(default_factory=list)


async def resolve_oracle_project_profile(db: AsyncSession, oracle_project_id: str) -> OracleProjectProfile:
    number = oracle_project_id.strip()
    project = (
        await db.execute(select(OracleProjectMaster).where(OracleProjectMaster.project_number == number))
    ).scalar_one_or_none()
    if project is None:
        return OracleProjectProfile(found=False, oracle_project_id=number)

    profile = OracleProjectProfile(
        found=True,
        oracle_project_id=number,
        oracle_project_name=project.project_name,
        oracle_project_geo=project.project_geo,
        oracle_account_name=project.account_name,
    )

    org = (
        await db.execute(select(Organization).where(Organization.code == ORGANIZATION_CODE))
    ).scalar_one_or_none()
    if org is None:
        profile.notes.append(f"Organization {ORGANIZATION_CODE} is not set up in reference data.")
    else:
        profile.organization_id = org.id

    token = region_token(project.project_geo)
    if token is None:
        profile.notes.append("The Oracle project has no Project Geo, so Region and GEO must be selected.")
    else:
        matches = match_region(project.project_geo, await load_active_regions(db))
        if len(matches) == 1:
            profile.region_id = matches[0].id
            profile.geo_id = matches[0].geo_id
        elif matches:
            profile.notes.append(f'Project Geo "{project.project_geo}" matches more than one region.')
        else:
            profile.notes.append(f'Project Geo "{project.project_geo}" does not match any region.')

    if project.account_name:
        account = (
            await db.execute(
                select(Account).where(
                    func.lower(func.trim(Account.name)) == project.account_name.strip().lower(),
                    Account.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
        if account is None:
            profile.notes.append(f'Account "{project.account_name}" is not set up in the tool.')
        else:
            profile.account_id = account.id
    else:
        profile.notes.append("The Oracle project has no Account.")

    return profile
