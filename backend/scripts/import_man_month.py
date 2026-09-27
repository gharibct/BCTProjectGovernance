"""Load the Oracle "BCT Man Month Report" workbook (previous month's column).

Captures the month BEFORE today (e.g. run in Sep-2026 -> the AUG column, stored
as "Aug-26"), loads every row into integration_man_month, then updates
oracle_employee_master, oracle_project_master (with its Region / GEO resolved
from Project Geo) and oracle_project_allocation.

Run from backend/:
    python -m scripts.import_man_month "<file.xlsx>"                 # dry run
    python -m scripts.import_man_month "<file.xlsx>" --apply         # commit
    python -m scripts.import_man_month "<file.xlsx>" --as-of=2026-09-24

A dry run does the whole load inside a transaction and rolls it back, so the
counts it prints are exactly what --apply would write. Tables filled: the
staging table integration_man_month plus oracle_employee_master,
oracle_project_master, oracle_project_allocation and
oracle_project_month_allocation. --as-of overrides
"today" (useful for backfilling an earlier month). Re-running a month replaces
that month's rows; other months are untouched.
"""

import argparse
import asyncio
import sys
from datetime import date

from app.core.db import AsyncSessionLocal
from app.services.man_month_import import (
    LoadSummary,
    ManMonthFileError,
    ParseResult,
    load_man_month,
    parse_workbook,
    record_failed_run,
)

_SHOW = 10  # how many skips / warnings / conflicts to print


def _print_examples(title: str, items: list[str]) -> None:
    if not items:
        return
    print(f"\n{title}: {len(items)}")
    for line in items[:_SHOW]:
        print(f"  - {line}")
    if len(items) > _SHOW:
        print(f"  ... and {len(items) - _SHOW} more")


def _conflict_lines(conflicts: dict) -> list[str]:
    return [
        f"{key}: " + "; ".join(f"{attr} = {sorted(map(str, vals))}" for attr, vals in per_attr.items())
        for key, per_attr in conflicts.items()
    ]


def _report(parsed: ParseResult, summary: LoadSummary, applied: bool) -> None:
    m = summary.month
    print(f"\nMonth: {m.label} (column {m.column})   Mode: {'APPLIED' if applied else 'DRY RUN (rolled back)'}")
    print(f"Rows read: {summary.rows_read}   loaded: {summary.rows_loaded}   skipped: {summary.rows_skipped}")
    print(f"Employees: {summary.employees_inserted} new, {summary.employees_updated} updated")
    print(f"Projects:  {summary.projects_inserted} new, {summary.projects_updated} updated")
    print(
        f"Project allocations: {summary.project_allocations_inserted} new, "
        f"{summary.project_allocations_updated} updated"
    )
    print(f"Month allocations: {summary.allocations_written} written ({summary.allocations_removed} replaced)")
    _print_examples(
        "Project Geo with no matching Region (Region / GEO left blank)",
        [f"{geo}: {count} project(s)" for geo, count in sorted(summary.unmapped_project_geos.items())],
    )
    _print_examples("Skipped rows", parsed.skipped)
    _print_examples("Warnings", parsed.warnings)
    _print_examples("Employee attribute conflicts (last non-blank value kept)", _conflict_lines(summary.employee_conflicts))
    _print_examples("Project attribute conflicts (last non-blank value kept)", _conflict_lines(summary.project_conflicts))


async def _run(path: str, today: date, apply: bool) -> int:
    try:
        parsed = parse_workbook(path, today)
    except ManMonthFileError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    async with AsyncSessionLocal() as db:
        try:
            summary = await load_man_month(db, parsed, source_file=path.replace("\\", "/").split("/")[-1])
            if apply:
                await db.commit()
            else:
                await db.rollback()
        except Exception as exc:
            await db.rollback()
            try:
                await record_failed_run(db, parsed.month, path, f"{type(exc).__name__}: {exc}")
            except Exception:
                await db.rollback()  # e.g. the tables don't exist yet — the real error is printed below
            print(f"Load failed and was rolled back: {exc}", file=sys.stderr)
            return 1

    _report(parsed, summary, applied=apply)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Load the Oracle BCT Man Month Report (previous month).")
    parser.add_argument("file", help="path to the .xlsx workbook")
    parser.add_argument("--apply", action="store_true", help="commit (default is a dry run)")
    parser.add_argument("--as-of", type=date.fromisoformat, default=None, help="treat this YYYY-MM-DD as today")
    args = parser.parse_args()
    sys.exit(asyncio.run(_run(args.file, args.as_of or date.today(), args.apply)))


if __name__ == "__main__":
    main()
