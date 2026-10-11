"""Permanently delete one project and everything that hangs off it.

Every table with a project_id foreign key is ON DELETE CASCADE (checked against
db/tables/*.sql), so Postgres removes the dependents itself in the right order
once the projects row goes. Roughly, deepest first:

    commitment actuals, milestone payment details   (-> commitments / milestones)
    report attachments, status items, health items   (-> status reports)
    amendment snapshots                              (-> project_amendments)
    status reports, health declarations, RAID logs (risk / issue / dependency /
      assumption / opportunity), measurements (development / support / staffing /
      testing / cloud / consulting), metric targets, contractual commitments,
      milestone payments, DE assessments + module reviews + findings, AI
      suggestions, documents, amendments, attestations, proxy PMs, activity
      restrictions, oracle ids, resources, user_projects
    projects                                          <- last

project_creation_requests.approved_project_id is SET NULL (the request survives).

Two things have NO foreign key and would be left orphaned, so this script
removes them first, in the same transaction:
    notifications / user_activity_log rows pointing at the project (or its
    status reports / amendments)
and one lives outside the DB:
    uploaded files under DOCUMENT_STORAGE_DIR (project documents, report
    attachments). Listed after commit; pass --delete-files to remove them.

Run from backend/:
    python -m scripts.delete_project PRJ-001 --dry-run     # show what would go
    python -m scripts.delete_project PRJ-001                # asks you to retype the code
    python -m scripts.delete_project PRJ-001 --delete-files
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Target database: edit this line. Not read from .env (set before app modules load).
DATABASE_URL = "postgresql+asyncpg://postgres:postgres@13.126.15.148:5432/project_governance"

os.environ["DATABASE_URL"] = DATABASE_URL

from sqlalchemy import text  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.db import AsyncSessionLocal  # noqa: E402

# Every table that has a project_id column, per the live catalog (so tables added
# later are counted too).
_PROJECT_TABLES_SQL = text(
    """
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = current_schema() AND c.column_name = 'project_id'
    ORDER BY c.table_name
    """
)


async def _run(code: str, dry_run: bool, assume_yes: bool, delete_files: bool) -> int:
    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(
                text("SELECT id, project_code, project_name, project_status FROM projects WHERE project_code = :c"),
                {"c": code},
            )
        ).first()
        if row is None:
            print(f"No project with code '{code}'.", file=sys.stderr)
            return 1
        pid = row.id
        print(f"Project: {row.project_code} - {row.project_name}  [{row.project_status}]  id={pid}")

        print("\nRows that will be deleted by cascade:")
        total = 0
        for (table,) in (await db.execute(_PROJECT_TABLES_SQL)).all():
            n = (await db.execute(text(f'SELECT count(*) FROM "{table}" WHERE project_id = :p'), {"p": pid})).scalar_one()
            if n:
                print(f"  {table:<40} {n}")
                total += n

        # Ids whose notifications / activity-log rows must go too.
        entity_ids = f"""
            SELECT CAST(:p AS uuid)
            UNION SELECT id FROM project_status_reports WHERE project_id = :p
            UNION SELECT id FROM project_amendments WHERE project_id = :p
        """
        n_notif = (
            await db.execute(text(f"SELECT count(*) FROM notifications WHERE entity_id IN ({entity_ids})"), {"p": pid})
        ).scalar_one()
        n_log = (
            await db.execute(text(f"SELECT count(*) FROM user_activity_log WHERE entity_id IN ({entity_ids})"), {"p": pid})
        ).scalar_one()
        print(f"  {'notifications (no FK)':<40} {n_notif}")
        print(f"  {'user_activity_log (no FK)':<40} {n_log}")

        files = [
            r[0]
            for r in (
                await db.execute(
                    text(
                        """
                        SELECT storage_path FROM project_documents WHERE project_id = :p
                        UNION ALL
                        SELECT a.file_path FROM report_attachments a
                          JOIN project_status_reports r ON r.id = a.project_report_id
                         WHERE r.project_id = :p
                        """
                    ),
                    {"p": pid},
                )
            ).all()
        ]
        print(f"  {'uploaded files on disk':<40} {len(files)}")

        if dry_run:
            print(f"\n[dry-run] {total} cascaded row(s) + 1 project. Nothing deleted.")
            return 0

        if not assume_yes:
            if input(f"\nPermanently delete {row.project_code}? Retype the project code to confirm: ").strip() != row.project_code:
                print("Cancelled.")
                return 1

        # 1) rows with no FK -> 2) the project (cascades the rest, deepest first).
        await db.execute(text(f"DELETE FROM notifications WHERE entity_id IN ({entity_ids})"), {"p": pid})
        await db.execute(text(f"DELETE FROM user_activity_log WHERE entity_id IN ({entity_ids})"), {"p": pid})
        await db.execute(text("DELETE FROM projects WHERE id = :p"), {"p": pid})
        await db.commit()
        print(f"\nDeleted {row.project_code}.")

    base = Path(settings.document_storage_dir)
    if files and delete_files:
        removed = 0
        for rel in files:
            f = base / rel
            if f.is_file():
                f.unlink()
                removed += 1
        print(f"Removed {removed}/{len(files)} file(s) from {base}.")
    elif files:
        print(f"{len(files)} uploaded file(s) remain under {base} (re-run with --delete-files, or remove manually):")
        for rel in files:
            print(f"  {rel}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Permanently delete a project and all its data.")
    parser.add_argument("project_code")
    parser.add_argument("--dry-run", action="store_true", help="show row counts, delete nothing")
    parser.add_argument("--yes", action="store_true", help="skip the retype-to-confirm prompt")
    parser.add_argument("--delete-files", action="store_true", help="also remove the project's uploaded files from disk")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run(args.project_code, args.dry_run, args.yes, args.delete_files)))


if __name__ == "__main__":
    main()
