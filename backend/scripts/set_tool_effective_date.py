"""Set projects.tool_effective_date directly in the database.

Updates only that one column (no baseline lock, no amendment, no audit row) - it is
a data-fix tool, so use --dry-run first.

Run from backend/:
    # one project
    python -m scripts.set_tool_effective_date PRJ-001 2026-04-01 --dry-run
    python -m scripts.set_tool_effective_date PRJ-001 2026-04-01

    # clear it (falls back to actual / planned start date)
    python -m scripts.set_tool_effective_date PRJ-001 none

    # many projects from a CSV with header: project_code,tool_effective_date
    python -m scripts.set_tool_effective_date --csv dates.csv --dry-run
    python -m scripts.set_tool_effective_date --csv dates.csv

    # every project of an account (by account name) - same date for all
    python -m scripts.set_tool_effective_date --account "Acme Corp" 2026-04-01

Dates are YYYY-MM-DD. A blank / "none" date in the CSV clears the value.
"""

import argparse
import asyncio
import csv
import os
import sys
from datetime import date

# Target database: edit this line. Not read from .env (set before app modules load).
DATABASE_URL = "postgresql+asyncpg://postgres:postgres@13.126.15.148:5432/project_governance"

os.environ["DATABASE_URL"] = DATABASE_URL

from sqlalchemy import text  # noqa: E402

from app.core.db import AsyncSessionLocal  # noqa: E402


def _parse_date(raw: str | None) -> date | None:
    raw = (raw or "").strip()
    if raw.lower() in ("", "none", "null", "-"):
        return None
    return date.fromisoformat(raw)  # raises ValueError on a bad date


def _load_csv(path: str) -> list[tuple[str, date | None]]:
    out: list[tuple[str, date | None]] = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for n, rec in enumerate(csv.DictReader(f), start=2):
            code = (rec.get("project_code") or "").strip()
            if not code:
                continue
            try:
                out.append((code, _parse_date(rec.get("tool_effective_date"))))
            except ValueError:
                raise SystemExit(f"{path} line {n}: bad date '{rec.get('tool_effective_date')}' (use YYYY-MM-DD)")
    return out


async def _run(targets: list[tuple[str, date | None]], account: str | None, new_date: date | None, dry_run: bool, assume_yes: bool) -> int:
    async with AsyncSessionLocal() as db:
        if account:
            rows = (
                await db.execute(
                    text(
                        "SELECT p.project_code FROM projects p JOIN accounts a ON a.id = p.account_id "
                        "WHERE a.name = :n ORDER BY p.project_code"
                    ),
                    {"n": account},
                )
            ).all()
            if not rows:
                print(f"No projects found for account '{account}'.", file=sys.stderr)
                return 1
            targets = [(r.project_code, new_date) for r in rows]

        plan: list[tuple[object, str, date | None, date | None]] = []
        missing: list[str] = []
        for code, d in targets:
            r = (
                await db.execute(
                    text("SELECT id, project_code, tool_effective_date FROM projects WHERE project_code = :c"),
                    {"c": code},
                )
            ).first()
            if r is None:
                missing.append(code)
            else:
                plan.append((r.id, r.project_code, r.tool_effective_date, d))

        print(f"{'project_code':<20} {'current':<12} -> new")
        for _, code, old, new in plan:
            flag = "" if old != new else "   (no change)"
            print(f"{code:<20} {str(old):<12} -> {new}{flag}")
        for code in missing:
            print(f"{code:<20} NOT FOUND - skipped", file=sys.stderr)

        changes = [p for p in plan if p[2] != p[3]]
        if dry_run:
            print(f"\n[dry-run] {len(changes)} project(s) would change. Nothing written.")
            return 0
        if not changes:
            print("\nNothing to update.")
            return 0
        if not assume_yes and input(f"\nUpdate {len(changes)} project(s)? Type 'yes' to confirm: ").strip().lower() != "yes":
            print("Cancelled.")
            return 1

        for pid, _, _, new in changes:
            await db.execute(
                text("UPDATE projects SET tool_effective_date = :d WHERE id = :p"),
                {"d": new, "p": pid},
            )
        await db.commit()
        print(f"\nUpdated {len(changes)} project(s).")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description="Set projects.tool_effective_date.")
    ap.add_argument("args", nargs="*", help="<project_code> <date|none>, or just <date|none> with --account")
    ap.add_argument("--csv", help="CSV file with columns project_code,tool_effective_date")
    ap.add_argument("--account", help="apply the date to every project of this account name")
    ap.add_argument("--dry-run", action="store_true", help="show the changes, write nothing")
    ap.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    a = ap.parse_args()

    try:
        if a.csv:
            targets, account, new_date = _load_csv(a.csv), None, None
        elif a.account:
            if len(a.args) != 1:
                ap.error("with --account give exactly one <date|none>")
            targets, account, new_date = [], a.account, _parse_date(a.args[0])
        else:
            if len(a.args) != 2:
                ap.error("give <project_code> <date|none>, or use --csv / --account")
            targets, account, new_date = [(a.args[0], _parse_date(a.args[1]))], None, None
    except ValueError:
        ap.error("bad date - use YYYY-MM-DD, or 'none' to clear")

    raise SystemExit(asyncio.run(_run(targets, account, new_date, a.dry_run, a.yes)))


if __name__ == "__main__":
    main()
