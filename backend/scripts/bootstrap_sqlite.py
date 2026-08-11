"""One-time schema creation for local SQLite dev.

db/run_all.sql is Postgres-only psql DDL (extensions, plpgsql triggers,
JSONB/INET columns) and isn't usable against SQLite. Since none of that DDL
is managed through SQLAlchemy/Alembic anyway, this generates the dev schema
straight from the ORM models instead of porting the SQL.

Run from backend/: python -m scripts.bootstrap_sqlite
"""

import asyncio

from app.core.config import settings
from app.core.db import Base, engine

# Import the endpoint router so every crud/*.py -> models/*.py chain runs,
# which is what actually populates Base.metadata (models/__init__.py and
# crud/__init__.py are both empty).
from app.api.v1.router import api_router  # noqa: F401


async def main() -> None:
    if not settings.database_url.startswith("sqlite"):
        raise SystemExit(
            f"Refusing to run: DATABASE_URL is not sqlite ({settings.database_url!r}). "
            "This would create a parallel, out-of-sync schema on a real database. "
            "Point DATABASE_URL at sqlite+aiosqlite:///./dev.db first."
        )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # projects.planned_duration_days / actual_duration_days are Postgres
    # GENERATED ALWAYS ... STORED columns in db/tables/03_projects.sql, marked
    # server_default=FetchedValue() on the model purely so SQLAlchemy omits
    # them from INSERT/UPDATE. create_all() creates them as plain nullable
    # INTEGER columns here, so they always read back NULL in SQLite dev.
    # Nothing in the app computes or depends on their value beyond exposing
    # them in API responses, so this is an accepted dev-only limitation.

    print(f"Created {len(Base.metadata.tables)} tables in {settings.database_url}")


if __name__ == "__main__":
    asyncio.run(main())
