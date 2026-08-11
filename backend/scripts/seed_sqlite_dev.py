"""Dev reference-data seed for local SQLite, mirroring db/seed_dev.sql.

db/seed_dev.sql uses Postgres-only syntax (gen_random_uuid(), now()), so this
reuses the existing CRUD layer instead (portable to either backend, since
id/timestamps are already generated in Python by CRUDBase.create).

Not idempotent: delete dev.db and rerun bootstrap_sqlite + this script for a
clean slate rather than re-running against an already-seeded database.

Run from backend/: python -m scripts.seed_sqlite_dev
"""

import asyncio
from uuid import uuid4

from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.crud.reference_data import account_crud, geo_crud, organization_crud, project_type_crud
from app.crud.users import user_crud
from app.models.users import Role
from app.schemas.reference_data import AccountCreate, GeoCreate, OrganizationCreate, ProjectTypeCreate
from app.schemas.users import UserCreate

ROLES = [
    ("ADMIN", "Admin", "Full system administration"),
    ("EXECUTIVE", "Executive", "CEO / CDO / GEO Head / Delivery Manager read-mostly access"),
    ("PROJECT_MANAGER", "Project Manager", "Owns project charter and delivery"),
    ("TEAM_MEMBER", "Team Member", "Delivery team member"),
    ("DELIVERY_EXCELLENCE", "Delivery Excellence", "DE assessments and governance"),
    ("PMO", "PMO", "Project Management Office"),
]

ORGANIZATIONS = [
    OrganizationCreate(code="BCTPL", name="BCT Private Limited"),
    OrganizationCreate(code="BCTC", name="BCT Consulting"),
    OrganizationCreate(code="FT", name="FinTech Unit"),
]

GEOS = [
    GeoCreate(code="APAC", name="Asia Pacific"),
    GeoCreate(code="MEA", name="Middle East & Africa"),
    GeoCreate(code="US", name="United States"),
]

PROJECT_TYPES = [
    ProjectTypeCreate(code="DEVELOPMENT", name="Development"),
    ProjectTypeCreate(code="PROFESSIONAL_STAFFING", name="Professional Staffing"),
    ProjectTypeCreate(code="SUPPORT", name="Support"),
    ProjectTypeCreate(code="TESTING", name="Testing"),
    ProjectTypeCreate(code="CLOUD_MAINTENANCE", name="Cloud Maintenance"),
    ProjectTypeCreate(code="CLOUD_MIGRATION", name="Cloud Migration"),
]

ACCOUNTS = [
    ("Gulf National Bank", "MEA"),
    ("Pacific Retail Group", "APAC"),
    ("Liberty Insurance Co", "US"),
]

USERS = [
    ("hari.g", "Hari G", "hari.g@bahwancybertek.com", "PMO"),
    ("rohan.mehta", "Rohan Mehta", "rohan.mehta@bahwancybertek.com", "PROJECT_MANAGER"),
    ("ayesha.khan", "Ayesha Khan", "ayesha.khan@bahwancybertek.com", "EXECUTIVE"),
    ("daniel.osei", "Daniel Osei", "daniel.osei@bahwancybertek.com", "DELIVERY_EXCELLENCE"),
    ("priya.nair", "Priya Nair", "priya.nair@bahwancybertek.com", "PROJECT_MANAGER"),
]


async def main() -> None:
    if not settings.database_url.startswith("sqlite"):
        raise SystemExit(
            f"Refusing to run: DATABASE_URL is not sqlite ({settings.database_url!r}). "
            "This would reseed a real shared database. "
            "Point DATABASE_URL at sqlite+aiosqlite:///./dev.db first."
        )

    async with AsyncSessionLocal() as db:
        # Role has no Create schema (read-only via the API), so build it directly.
        roles_by_code: dict[str, Role] = {}
        for code, name, description in ROLES:
            role = Role(id=uuid4(), code=code, name=name, description=description)
            db.add(role)
            roles_by_code[code] = role
        await db.flush()

        for org in ORGANIZATIONS:
            await organization_crud.create(db, org)

        geos_by_code: dict[str, object] = {}
        for geo in GEOS:
            geos_by_code[geo.code] = await geo_crud.create(db, geo)

        for pt in PROJECT_TYPES:
            await project_type_crud.create(db, pt)

        for name, geo_code in ACCOUNTS:
            await account_crud.create(db, AccountCreate(name=name, geo_id=geos_by_code[geo_code].id))

        for ldap_username, full_name, email, role_code in USERS:
            await user_crud.create(
                db,
                UserCreate(
                    ldap_username=ldap_username,
                    full_name=full_name,
                    email=email,
                    role_id=roles_by_code[role_code].id,
                ),
            )

        await db.commit()

    print(f"Seeded {len(ROLES)} roles, {len(ORGANIZATIONS)} organizations, {len(GEOS)} geos, "
          f"{len(PROJECT_TYPES)} project types, {len(ACCOUNTS)} accounts, {len(USERS)} users.")


if __name__ == "__main__":
    asyncio.run(main())
