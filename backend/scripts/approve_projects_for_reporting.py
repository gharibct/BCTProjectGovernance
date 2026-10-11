"""Phase 1 bootstrap: mark Draft projects Approved so teams can report status.

Projects created without commitments / milestones cannot pass the application's
approval readiness check. This moves them straight to "Approved" (the same
fields the DE "Approve" decision sets) so Project Status reporting works now.
Teams later use Initiate Amendment (Approved -> Under Amendment) to add the
commitments, milestones and other details, and resubmit through the normal flow.

What it sets, per project:
    project_status     = 'Approved'
    de_review_status   = 'Approved'
    de_review_remarks  = <REMARKS below>
    de_reviewed_at     = now          (de_reviewed_by stays NULL: no human reviewer)
    lifecycle_status   = 'Ongoing'    (only if currently NULL, as the real approval does)

Nothing else is touched, and no notifications are sent.

Run from backend/:
    python -m scripts.approve_projects_for_reporting --dry-run
    python -m scripts.approve_projects_for_reporting
    python -m scripts.approve_projects_for_reporting --codes PRJ-001,PRJ-002
"""

import argparse
import asyncio
import os
from datetime import UTC, datetime

# Target database: edit this line. Not read from .env (set before app modules load).
DATABASE_URL = "postgresql+asyncpg://postgres:postgres@192.168.1.175:5432/Project_Governance_03"

os.environ["DATABASE_URL"] = DATABASE_URL

from sqlalchemy import select  # noqa: E402

from app.core.db import AsyncSessionLocal  # noqa: E402
from app.models.projects import Project  # noqa: E402

REMARKS = "Approved for initial status reporting; commitments and milestones to be added via amendment."


async def _run(codes: list[str] | None, dry_run: bool) -> int:
    async with AsyncSessionLocal() as db:
        stmt = select(Project).where(Project.project_status == "Draft").order_by(Project.project_code)
        if codes:
            stmt = stmt.where(Project.project_code.in_(codes))
        projects = (await db.execute(stmt)).scalars().all()

        if codes:
            missing = sorted(set(codes) - {p.project_code for p in projects})
            if missing:
                print(f"Not found or not in Draft (ignored): {', '.join(missing)}")

        if not projects:
            print("No Draft projects to approve.")
            return 0

        now = datetime.now(UTC)
        for p in projects:
            print(f"  {p.project_code}  {p.project_name}")
            p.project_status = "Approved"
            p.de_review_status = "Approved"
            p.de_review_remarks = REMARKS
            p.de_reviewed_at = now
            if p.lifecycle_status is None:
                p.lifecycle_status = "Ongoing"
            p.updated_at = now

        if dry_run:
            await db.rollback()
            print(f"[dry-run] would approve {len(projects)} project(s). Nothing written.")
            return 0

        await db.commit()
        print(f"Approved {len(projects)} project(s).")
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Mark Draft projects Approved for initial status reporting.")
    parser.add_argument("--codes", help="comma-separated project codes (default: every Draft project)")
    parser.add_argument("--dry-run", action="store_true", help="list what would change, write nothing")
    args = parser.parse_args()
    codes = [c.strip() for c in args.codes.split(",") if c.strip()] if args.codes else None
    raise SystemExit(asyncio.run(_run(codes, args.dry_run)))


if __name__ == "__main__":
    main()
