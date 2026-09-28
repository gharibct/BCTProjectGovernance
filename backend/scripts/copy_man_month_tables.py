"""Copy the Oracle man-month tables from one database to another on the same server.

Copies, keeping every id as-is:
    integration_load_run, integration_man_month, oracle_employee_master,
    oracle_project_master, oracle_project_allocation, oracle_project_month_allocation

Typical use: the month was imported into the test database and the same data is
needed in preprod. Credentials and host come from DATABASE_URL (.env); only the
database name changes.

Run from backend/:
    python -m scripts.copy_man_month_tables --source-db Project_Governance_03 --target-db Project_Governance_pre           # dry run
    python -m scripts.copy_man_month_tables --source-db Project_Governance_03 --target-db Project_Governance_pre --apply   # commit

--source-db defaults to the database in DATABASE_URL. The target tables must be
empty unless --replace is given, which clears those six tables in the target first
(nothing else references them). A dry run does everything inside a transaction and
rolls it back, so the counts printed are exactly what --apply would write.

oracle_project_master.region_id / geo_id point at the regions / geos tables, whose
ids differ per database, so they are re-resolved in the target by geo code and by
(geo code, region code); a project whose region/geo isn't found there is left blank
(NULL) and listed.
"""

import argparse
import asyncio
import sys

import asyncpg
from sqlalchemy.engine import make_url

from app.core.config import settings

# Parents first (insert order); the reverse is safe for deletes.
TABLES = (
    "integration_load_run",
    "oracle_employee_master",
    "oracle_project_master",
    "integration_man_month",
    "oracle_project_allocation",
    "oracle_project_month_allocation",
)
_SHOW = 10


async def _connect(database: str) -> asyncpg.Connection:
    url = make_url(settings.database_url)
    if not url.drivername.startswith("postgresql"):
        raise SystemExit(f"This script needs a PostgreSQL DATABASE_URL (got {url.drivername}).")
    return await asyncpg.connect(
        host=url.host, port=url.port or 5432, user=url.username, password=url.password, database=database
    )


async def _columns(conn: asyncpg.Connection, table: str) -> list[str]:
    rows = await conn.fetch(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
        table,
    )
    return [r["column_name"] for r in rows]


async def _geo_region_maps(conn: asyncpg.Connection) -> tuple[dict, dict]:
    """(geo id -> geo code, region id -> (geo code, region code)) for one database."""
    geos = {r["id"]: r["code"] for r in await conn.fetch("SELECT id, code FROM geos")}
    regions = {
        r["id"]: (geos.get(r["geo_id"]), r["code"]) for r in await conn.fetch("SELECT id, geo_id, code FROM regions")
    }
    return geos, regions


async def _remap_geo_region(src: asyncpg.Connection, dst: asyncpg.Connection, rows: list, cols: list[str]):
    """Rewrite region_id / geo_id of oracle_project_master rows for the target database."""
    src_geos, src_regions = await _geo_region_maps(src)
    dst_geos, dst_regions = await _geo_region_maps(dst)
    geo_by_code = {code: gid for gid, code in dst_geos.items()}
    region_by_key = {key: rid for rid, key in dst_regions.items()}
    gi, ri, ni = cols.index("geo_id"), cols.index("region_id"), cols.index("project_number")

    out, unresolved = [], []
    for row in rows:
        row = list(row)
        if row[gi] is not None:
            new = geo_by_code.get(src_geos.get(row[gi]))
            if new is None:
                unresolved.append(f"{row[ni]}: geo {src_geos.get(row[gi])!r}")
            row[gi] = new
        if row[ri] is not None:
            new = region_by_key.get(src_regions.get(row[ri]))
            if new is None:
                unresolved.append(f"{row[ni]}: region {src_regions.get(row[ri])!r}")
            row[ri] = new
        out.append(tuple(row))
    return out, unresolved


async def _copy(source_db: str, target_db: str, apply: bool, replace: bool) -> int:
    src = await _connect(source_db)
    dst = await _connect(target_db)
    try:
        # Same column set on both sides, or the copy would silently drop / misplace data.
        columns: dict[str, list[str]] = {}
        for table in TABLES:
            s_cols, d_cols = await _columns(src, table), await _columns(dst, table)
            if not s_cols or not d_cols:
                print(f"Table {table} is missing in {'source' if not s_cols else 'target'} database.", file=sys.stderr)
                return 1
            if set(s_cols) != set(d_cols):
                print(
                    f"Table {table} differs between databases: "
                    f"only in source {sorted(set(s_cols) - set(d_cols))}, only in target {sorted(set(d_cols) - set(s_cols))}."
                    " Apply the same migrations first.",
                    file=sys.stderr,
                )
                return 1
            columns[table] = s_cols

        counts_before = {t: await dst.fetchval(f'SELECT count(*) FROM "{t}"') for t in TABLES}
        if any(counts_before.values()) and not replace:
            filled = ", ".join(f"{t} ({n})" for t, n in counts_before.items() if n)
            print(f"Target already has data in: {filled}. Use --replace to clear those tables first.", file=sys.stderr)
            return 1

        report: list[tuple[str, int, int]] = []
        unresolved: list[str] = []
        tx = dst.transaction()
        await tx.start()
        try:
            if replace:
                await dst.execute("TRUNCATE " + ", ".join(f'"{t}"' for t in TABLES))
            for table in TABLES:
                cols = columns[table]
                quoted = ", ".join(f'"{c}"' for c in cols)
                rows = [tuple(r) for r in await src.fetch(f'SELECT {quoted} FROM "{table}"')]
                if table == "oracle_project_master":
                    rows, unresolved = await _remap_geo_region(src, dst, rows, cols)
                await dst.copy_records_to_table(table, records=rows, columns=cols)
                report.append((table, counts_before[table], len(rows)))
            if apply:
                await tx.commit()
            else:
                await tx.rollback()
        except Exception:
            await tx.rollback()
            raise
    finally:
        await src.close()
        await dst.close()

    print(f"\nSource: {source_db}   Target: {target_db}   Mode: {'APPLIED' if apply else 'DRY RUN (rolled back)'}")
    print(f"{'table':38}{'target before':>15}{'copied':>10}")
    for table, before, copied in report:
        print(f"{table:38}{before:>15}{copied:>10}")
    if unresolved:
        print(f"\nRegion/GEO not found in target (left blank): {len(unresolved)}")
        for line in unresolved[:_SHOW]:
            print(f"  - {line}")
        if len(unresolved) > _SHOW:
            print(f"  ... and {len(unresolved) - _SHOW} more")
    return 0


def main() -> None:
    default_source = make_url(settings.database_url).database
    parser = argparse.ArgumentParser(description="Copy the Oracle man-month tables between two databases on one server.")
    parser.add_argument("--source-db", default=default_source, help=f"database to copy from (default: {default_source})")
    parser.add_argument("--target-db", required=True, help="database to copy into")
    parser.add_argument("--apply", action="store_true", help="commit (default is a dry run)")
    parser.add_argument("--replace", action="store_true", help="clear the target's copies of these tables first")
    args = parser.parse_args()
    if args.source_db == args.target_db:
        parser.error("source and target database are the same")
    sys.exit(asyncio.run(_copy(args.source_db, args.target_db, args.apply, args.replace)))


if __name__ == "__main__":
    main()
