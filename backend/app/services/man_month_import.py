"""Load the Oracle "BCT Man Month Report" workbook.

One month is captured per load: the month *before* the load date, taken from
the matching APR..MAR column ("Aug-26" when run in September 2026). Every
source row is written to `integration_man_month`; four tables are then derived
from those rows:

* `oracle_employee_master` / `oracle_project_master` - one row per employee / project;
* `oracle_project_allocation` - one row per allocation period (employee + project +
  allocation start date, carrying the percentage and end date); kept as history
  when a row later drops out of the report;
* `oracle_project_month_allocation` - the target month's man-month of each allocation.

`parse_workbook` is pure (file in, rows out) and `load_man_month` does all the
writes without committing, so the caller decides between commit and rollback
(the CLI's dry run rolls back).
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import openpyxl
from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.oracle_man_month import (
    IntegrationLoadRun,
    IntegrationManMonth,
    OracleEmployeeMaster,
    OracleProjectAllocation,
    OracleProjectMaster,
    OracleProjectMonthAllocation,
)
from app.services.oracle_project_profile import load_active_regions, match_region

SOURCE_NAME = "BCT_MAN_MONTH"

# Fixed English abbreviations (not locale-dependent): index = month number - 1.
MONTH_ABBR = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

# Header (lower-cased) -> row attribute, for the columns copied as-is.
_TEXT_HEADERS = {
    "employee geo": "employee_geo",
    "operating unit": "operating_unit",
    "account": "account_name",
    "employee number": "employee_number",
    "name": "name",
    "employment type": "employment_type",
    "designation": "designation",
    "grade": "grade",
    "department": "department",
    "location": "location",
    "project number": "project_number",
    "project name": "project_name",
    "project type": "project_type",
    "project ou": "project_ou",
    "project geo": "project_geo",
    "project sbu code": "project_sbu_code",
    "project sbu name": "project_sbu_name",
    "project practice": "project_practice",
    "role": "role",
}
_DATE_HEADERS = {
    "doj": "doj",
    "termination date": "termination_date",
    "project start date": "project_start_date",
    "project end date": "project_end_date",
    "allocation start date": "allocation_start_date",
    "allocation end date": "allocation_end_date",
}
_DECIMAL_HEADERS = {"percentage allocation": "percentage_allocation"}

# Columns the file must have (every column in integration/ColumnsRequired.xlsx).
# Role is captured when present but not required: it isn't part of any derived table.
_REQUIRED_HEADERS = (
    "employee geo",
    "operating unit",
    "account",
    "employee number",
    "name",
    "employment type",
    "designation",
    "grade",
    "department",
    "doj",
    "termination date",
    "location",
    "project number",
    "project name",
    "project type",
    "project ou",
    "project geo",
    "project start date",
    "project end date",
    "project sbu code",
    "project sbu name",
    "project practice",
    "percentage allocation",
    "allocation start date",
    "allocation end date",
)

EMPLOYEE_ATTRS = (
    "name",
    "employment_type",
    "designation",
    "grade",
    "department",
    "employee_geo",
    "operating_unit",
    "doj",
    "termination_date",
    "location",
)
PROJECT_ATTRS = (
    "project_name",
    "account_name",
    "project_type",
    "project_ou",
    "project_geo",
    "project_start_date",
    "project_end_date",
    "project_sbu_code",
    "project_sbu_name",
    "project_practice",
)
ALLOCATION_ATTRS = ("percentage_allocation", "allocation_end_date")

_CHUNK = 500


@dataclass(frozen=True)
class TargetMonth:
    month_start: date  # 2026-08-01
    column: str  # "AUG" — the workbook column holding this month's values
    label: str  # "Aug-26"


def resolve_target_month(today: date) -> TargetMonth:
    """The month before `today`, whatever the day (a January run gives December)."""
    prev = today.replace(day=1) - timedelta(days=1)
    abbr = MONTH_ABBR[prev.month - 1]
    return TargetMonth(
        month_start=prev.replace(day=1),
        column=abbr.upper(),
        label=f"{abbr}-{prev.year % 100:02d}",
    )


@dataclass
class ManMonthRow:
    source_row_no: int
    employee_number: str
    project_number: str
    project_name: str
    man_month: Decimal | None = None
    name: str | None = None
    employment_type: str | None = None
    designation: str | None = None
    grade: str | None = None
    department: str | None = None
    employee_geo: str | None = None
    operating_unit: str | None = None
    doj: date | None = None
    termination_date: date | None = None
    location: str | None = None
    account_name: str | None = None
    project_type: str | None = None
    project_ou: str | None = None
    project_geo: str | None = None
    project_start_date: date | None = None
    project_end_date: date | None = None
    project_sbu_code: str | None = None
    project_sbu_name: str | None = None
    project_practice: str | None = None
    role: str | None = None
    percentage_allocation: Decimal | None = None
    allocation_start_date: date | None = None
    allocation_end_date: date | None = None


@dataclass
class ParseResult:
    month: TargetMonth
    rows: list[ManMonthRow] = field(default_factory=list)
    rows_read: int = 0
    skipped: list[str] = field(default_factory=list)  # human-readable reasons
    warnings: list[str] = field(default_factory=list)


class ManMonthFileError(Exception):
    """The workbook can't be used (unreadable, or a required column is missing)."""


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)  # an Excel-numeric id like 150562.0 must stay "150562"
    text = str(value).strip()
    return text or None


def _clean_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        raise ValueError(f"not a date: {value!r}") from None


def _clean_decimal(value: Any, places: str) -> Decimal | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    try:
        return Decimal(str(value).strip()).quantize(Decimal(places))
    except InvalidOperation:
        raise ValueError(f"not a number: {value!r}") from None


def parse_workbook(path: str | Path, today: date) -> ParseResult:
    """Read the sheet's rows for the month before `today`."""
    month = resolve_target_month(today)
    try:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    except Exception as exc:  # openpyxl raises a wide range of errors for bad files
        raise ManMonthFileError(f"Couldn't read {path}: {exc}") from exc

    try:
        sheet_rows = wb.worksheets[0].iter_rows(values_only=True)
        header_row = next(sheet_rows, None)
        if header_row is None:
            raise ManMonthFileError("The first sheet is empty.")
        headers = {
            str(h).strip().lower(): i for i, h in enumerate(header_row) if h is not None and str(h).strip()
        }
        missing = [h for h in (*_REQUIRED_HEADERS, month.column.lower()) if h not in headers]
        if missing:
            raise ManMonthFileError(f"Missing column(s) in the first sheet: {', '.join(missing)}")

        result = ParseResult(month=month)
        month_ix = headers[month.column.lower()]
        for row_no, raw in enumerate(sheet_rows, start=2):
            if raw is None or not any(c is not None and str(c).strip() for c in raw):
                continue  # a fully blank row is not a data row
            result.rows_read += 1
            parsed = _parse_row(row_no, raw, headers, month_ix, result)
            if parsed is not None:
                result.rows.append(parsed)
        return result
    finally:
        wb.close()


def _cell(raw: tuple, headers: dict[str, int], header: str) -> Any:
    ix = headers.get(header)
    return raw[ix] if ix is not None and ix < len(raw) else None


def _parse_row(
    row_no: int, raw: tuple, headers: dict[str, int], month_ix: int, result: ParseResult
) -> ManMonthRow | None:
    values: dict[str, Any] = {}
    for header, attr in _TEXT_HEADERS.items():
        values[attr] = _clean_text(_cell(raw, headers, header))

    for required in ("employee_number", "project_number", "project_name"):
        if values[required] is None:
            result.skipped.append(f"row {row_no}: blank {required.replace('_', ' ')}")
            return None

    # The month value is what the load is for, so an unreadable one drops the row.
    try:
        values["man_month"] = _clean_decimal(raw[month_ix] if month_ix < len(raw) else None, "0.0001")
    except ValueError as exc:
        result.skipped.append(f"row {row_no}: month value {exc}")
        return None

    # Every other column is descriptive: a bad value is blanked and reported
    # rather than losing an otherwise good row.
    bad_headers: set[str] = set()
    for header, attr in _DATE_HEADERS.items():
        try:
            values[attr] = _clean_date(_cell(raw, headers, header))
        except ValueError as exc:
            values[attr] = None
            bad_headers.add(header)
            result.warnings.append(f"row {row_no}: {header} {exc} (left blank)")
    for header, attr in _DECIMAL_HEADERS.items():
        try:
            values[attr] = _clean_decimal(_cell(raw, headers, header), "0.01")
        except ValueError as exc:
            values[attr] = None
            result.warnings.append(f"row {row_no}: {header} {exc} (left blank)")

    # The start date is part of an allocation's identity: without one the row
    # still feeds the masters, but no allocation row can be made for it.
    if values["allocation_start_date"] is None and "allocation start date" not in bad_headers:
        result.warnings.append(f"row {row_no}: blank allocation start date (no allocation row created)")

    return ManMonthRow(source_row_no=row_no, **values)


# --- derivation -------------------------------------------------------------


def collapse_by_key(
    rows: Iterable[ManMonthRow], key_attr: str, attrs: tuple[str, ...]
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, set]]]:
    """One record per key: each attribute takes its last non-blank value in file order.

    Also returns the keys whose attribute had more than one distinct non-blank
    value (e.g. an employee's name spelled two ways), for the run report.
    """
    merged: dict[str, dict[str, Any]] = {}
    seen: dict[str, dict[str, set]] = defaultdict(lambda: defaultdict(set))
    for row in rows:
        key = getattr(row, key_attr)
        record = merged.setdefault(key, {a: None for a in attrs})
        for attr in attrs:
            value = getattr(row, attr)
            if value is not None:
                record[attr] = value
                seen[key][attr].add(value)
    conflicts = {
        key: {a: vals for a, vals in per_attr.items() if len(vals) > 1}
        for key, per_attr in seen.items()
        if any(len(vals) > 1 for vals in per_attr.values())
    }
    return merged, conflicts


AllocationKey = tuple[str, str, date]  # (employee number, project number, allocation start date)


@dataclass
class CollapsedAllocation:
    percentage_allocation: Decimal | None = None
    allocation_end_date: date | None = None
    # Sum of the target month's value over the source rows behind this allocation
    # (normally exactly one). None = the report is blank for the month, so there is
    # no month allocation; an explicit 0 is kept.
    man_month: Decimal | None = None
    source_row_count: int = 0


def collapse_allocations(rows: Iterable[ManMonthRow]) -> dict[AllocationKey, CollapsedAllocation]:
    """One record per allocation period. Rows with no allocation start date are left out.

    Like the masters, each attribute takes its last non-blank value in file order.
    """
    merged: dict[AllocationKey, CollapsedAllocation] = {}
    for row in rows:
        if row.allocation_start_date is None:
            continue
        record = merged.setdefault(
            (row.employee_number, row.project_number, row.allocation_start_date), CollapsedAllocation()
        )
        record.source_row_count += 1
        for attr in ALLOCATION_ATTRS:
            value = getattr(row, attr)
            if value is not None:
                setattr(record, attr, value)
        if row.man_month is not None:
            record.man_month = (record.man_month or Decimal("0")) + row.man_month
    return merged


def _chunks(items: list, size: int = _CHUNK) -> Iterator[list]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


# --- loading ----------------------------------------------------------------


@dataclass
class LoadSummary:
    run_id: uuid.UUID
    month: TargetMonth
    rows_read: int
    rows_loaded: int
    rows_skipped: int
    employees_inserted: int = 0
    employees_updated: int = 0
    projects_inserted: int = 0
    projects_updated: int = 0
    project_allocations_inserted: int = 0
    project_allocations_updated: int = 0
    allocations_written: int = 0  # month allocations
    allocations_removed: int = 0  # month allocations
    employee_conflicts: dict[str, dict[str, set]] = field(default_factory=dict)
    project_conflicts: dict[str, dict[str, set]] = field(default_factory=dict)
    # Project Geo value -> number of projects whose Region / GEO couldn't be resolved from it.
    unmapped_project_geos: dict[str, int] = field(default_factory=dict)


async def _resolve_project_regions(
    db: AsyncSession, projects: dict[str, dict[str, Any]]
) -> dict[str, int]:
    """Add `region_id` / `geo_id` to each collapsed project record, from its `project_geo`.

    "BCT US" resolves to the US region and that region's GEO. A project geo that
    matches no active region (or several) leaves both None - a None never
    overwrites a stored value on upsert. Returns the unresolved project geos with
    their project counts, for the run report.
    """
    regions = await load_active_regions(db)
    unmapped: dict[str, int] = defaultdict(int)
    for values in projects.values():
        matches = match_region(values.get("project_geo"), regions)
        if len(matches) == 1:
            values["region_id"] = matches[0].id
            values["geo_id"] = matches[0].geo_id
        else:
            values["region_id"] = values["geo_id"] = None
            if values.get("project_geo"):
                unmapped[values["project_geo"]] += 1
    return dict(unmapped)


async def _upsert_master(
    db: AsyncSession,
    model: type,
    key_attr: str,
    attrs: tuple[str, ...],
    collapsed: dict[str, dict[str, Any]],
    month_start: date,
    run_id: uuid.UUID,
    now: datetime,
) -> tuple[dict[str, uuid.UUID], int, int]:
    """Insert new masters and refresh existing ones. Returns (key -> id, inserted, updated).

    A blank value never overwrites a stored one, and a load of an older month
    can't clobber attributes from a newer one (it only widens first/last seen).
    """
    existing: dict[str, Any] = {}
    keys = list(collapsed)
    for chunk in _chunks(keys):
        found = await db.execute(select(model).where(getattr(model, key_attr).in_(chunk)))
        for obj in found.scalars():
            existing[getattr(obj, key_attr)] = obj

    ids: dict[str, uuid.UUID] = {}
    inserted = updated = 0
    for key, values in collapsed.items():
        obj = existing.get(key)
        if obj is None:
            obj = model(
                id=uuid.uuid4(),
                **{key_attr: key},
                **values,
                first_seen_month=month_start,
                last_seen_month=month_start,
                last_load_run_id=run_id,
                created_at=now,
                updated_at=now,
            )
            db.add(obj)
            inserted += 1
        else:
            obj.first_seen_month = min(obj.first_seen_month, month_start)
            if month_start >= obj.last_seen_month:
                changed = False
                for attr, value in values.items():
                    if value is not None and getattr(obj, attr) != value:
                        setattr(obj, attr, value)
                        changed = True
                obj.last_seen_month = month_start
                obj.last_load_run_id = run_id
                if changed:
                    obj.updated_at = now
                    updated += 1
        ids[key] = obj.id
    await db.flush()
    return ids, inserted, updated


async def _upsert_allocations(
    db: AsyncSession,
    collapsed: dict[AllocationKey, CollapsedAllocation],
    employee_ids: dict[str, uuid.UUID],
    project_ids: dict[str, uuid.UUID],
    month_start: date,
    run_id: uuid.UUID,
    now: datetime,
) -> tuple[dict[AllocationKey, uuid.UUID], int, int]:
    """Insert new allocation periods and refresh existing ones. Returns (key -> id, inserted, updated).

    Same rules as the masters: a blank value never overwrites a stored one and an
    older month can't clobber a newer one. Allocations missing from the file are
    left alone (history).
    """
    existing: dict[tuple[uuid.UUID, uuid.UUID, date], OracleProjectAllocation] = {}
    for chunk in _chunks(list({employee_ids[emp] for emp, _, _ in collapsed})):
        found = await db.execute(
            select(OracleProjectAllocation).where(OracleProjectAllocation.employee_id.in_(chunk))
        )
        for obj in found.scalars():
            existing[(obj.employee_id, obj.project_id, obj.allocation_start_date)] = obj

    ids: dict[AllocationKey, uuid.UUID] = {}
    inserted = updated = 0
    for key, record in collapsed.items():
        emp, proj, start = key
        db_key = (employee_ids[emp], project_ids[proj], start)
        values = {attr: getattr(record, attr) for attr in ALLOCATION_ATTRS}
        obj = existing.get(db_key)
        if obj is None:
            obj = OracleProjectAllocation(
                id=uuid.uuid4(),
                employee_id=db_key[0],
                project_id=db_key[1],
                allocation_start_date=start,
                **values,
                first_seen_month=month_start,
                last_seen_month=month_start,
                last_load_run_id=run_id,
                created_at=now,
                updated_at=now,
            )
            db.add(obj)
            inserted += 1
        else:
            obj.first_seen_month = min(obj.first_seen_month, month_start)
            if month_start >= obj.last_seen_month:
                changed = False
                for attr, value in values.items():
                    if value is not None and getattr(obj, attr) != value:
                        setattr(obj, attr, value)
                        changed = True
                obj.last_seen_month = month_start
                obj.last_load_run_id = run_id
                if changed:
                    obj.updated_at = now
                    updated += 1
        ids[key] = obj.id
    await db.flush()
    return ids, inserted, updated


async def load_man_month(db: AsyncSession, parsed: ParseResult, source_file: str) -> LoadSummary:
    """Write one parsed month. Flushes but never commits."""
    month = parsed.month
    now = datetime.now(UTC)
    run = IntegrationLoadRun(
        id=uuid.uuid4(),
        source_name=SOURCE_NAME,
        source_file=source_file,
        month=month.label,
        month_start=month.month_start,
        status="SUCCESS",
        rows_read=parsed.rows_read,
        rows_loaded=len(parsed.rows),
        rows_skipped=len(parsed.skipped),
        employees_inserted=0,
        employees_updated=0,
        projects_inserted=0,
        projects_updated=0,
        project_allocations_inserted=0,
        project_allocations_updated=0,
        allocations_written=0,
        allocations_removed=0,
        started_at=now,
    )
    db.add(run)
    await db.flush()

    # 1. Base table: replace this month's rows (re-running a month is safe; other
    #    months stay as history).
    await db.execute(delete(IntegrationManMonth).where(IntegrationManMonth.month_start == month.month_start))
    base_rows = [
        {
            "id": uuid.uuid4(),
            "load_run_id": run.id,
            "source_row_no": r.source_row_no,
            "month": month.label,
            "month_start": month.month_start,
            "man_month": r.man_month,
            "employee_geo": r.employee_geo,
            "operating_unit": r.operating_unit,
            "account_name": r.account_name,
            "employee_number": r.employee_number,
            "name": r.name,
            "employment_type": r.employment_type,
            "designation": r.designation,
            "grade": r.grade,
            "department": r.department,
            "doj": r.doj,
            "termination_date": r.termination_date,
            "location": r.location,
            "project_number": r.project_number,
            "project_name": r.project_name,
            "project_type": r.project_type,
            "project_ou": r.project_ou,
            "project_geo": r.project_geo,
            "project_start_date": r.project_start_date,
            "project_end_date": r.project_end_date,
            "project_sbu_code": r.project_sbu_code,
            "project_sbu_name": r.project_sbu_name,
            "project_practice": r.project_practice,
            "role": r.role,
            "percentage_allocation": r.percentage_allocation,
            "allocation_start_date": r.allocation_start_date,
            "allocation_end_date": r.allocation_end_date,
            "created_at": now,
        }
        for r in parsed.rows
    ]
    for chunk in _chunks(base_rows, 200):
        await db.execute(insert(IntegrationManMonth), chunk)

    summary = LoadSummary(
        run_id=run.id,
        month=month,
        rows_read=parsed.rows_read,
        rows_loaded=len(parsed.rows),
        rows_skipped=len(parsed.skipped),
    )

    # 2. Masters.
    employees, summary.employee_conflicts = collapse_by_key(parsed.rows, "employee_number", EMPLOYEE_ATTRS)
    projects, summary.project_conflicts = collapse_by_key(parsed.rows, "project_number", PROJECT_ATTRS)
    summary.unmapped_project_geos = await _resolve_project_regions(db, projects)
    employee_ids, summary.employees_inserted, summary.employees_updated = await _upsert_master(
        db, OracleEmployeeMaster, "employee_number", EMPLOYEE_ATTRS, employees, month.month_start, run.id, now
    )
    project_ids, summary.projects_inserted, summary.projects_updated = await _upsert_master(
        db, OracleProjectMaster, "project_number", PROJECT_ATTRS, projects, month.month_start, run.id, now
    )

    # 3. Allocation periods: upserted; ones missing from the file stay as history.
    collapsed = collapse_allocations(parsed.rows)
    allocation_ids, summary.project_allocations_inserted, summary.project_allocations_updated = (
        await _upsert_allocations(db, collapsed, employee_ids, project_ids, month.month_start, run.id, now)
    )

    # 4. Month allocations: this month's set is replaced wholesale, so an
    #    allocation that has dropped out of the file (or gone blank for the
    #    month) also drops out of the table.
    removed = await db.execute(
        delete(OracleProjectMonthAllocation).where(OracleProjectMonthAllocation.month_start == month.month_start)
    )
    summary.allocations_removed = removed.rowcount or 0
    month_allocations = [
        {
            "id": uuid.uuid4(),
            "allocation_id": allocation_ids[key],
            "employee_id": employee_ids[key[0]],
            "project_id": project_ids[key[1]],
            "month": month.label,
            "month_start": month.month_start,
            "man_month": record.man_month,
            "last_load_run_id": run.id,
            "created_at": now,
            "updated_at": now,
        }
        for key, record in collapsed.items()
        if record.man_month is not None
    ]
    for chunk in _chunks(month_allocations, 200):
        await db.execute(insert(OracleProjectMonthAllocation), chunk)
    summary.allocations_written = len(month_allocations)

    run.employees_inserted = summary.employees_inserted
    run.employees_updated = summary.employees_updated
    run.projects_inserted = summary.projects_inserted
    run.projects_updated = summary.projects_updated
    run.project_allocations_inserted = summary.project_allocations_inserted
    run.project_allocations_updated = summary.project_allocations_updated
    run.allocations_written = summary.allocations_written
    run.allocations_removed = summary.allocations_removed
    run.finished_at = datetime.now(UTC)
    await db.flush()
    return summary


async def record_failed_run(db: AsyncSession, month: TargetMonth, source_file: str, error: str) -> None:
    """Persist a FAILED run row (the failed load itself was rolled back). Commits."""
    now = datetime.now(UTC)
    db.add(
        IntegrationLoadRun(
            id=uuid.uuid4(),
            source_name=SOURCE_NAME,
            source_file=source_file,
            month=month.label,
            month_start=month.month_start,
            status="FAILED",
            rows_read=0,
            rows_loaded=0,
            rows_skipped=0,
            employees_inserted=0,
            employees_updated=0,
            projects_inserted=0,
            projects_updated=0,
            project_allocations_inserted=0,
            project_allocations_updated=0,
            allocations_written=0,
            allocations_removed=0,
            error=error[:2000],
            started_at=now,
            finished_at=now,
        )
    )
    await db.commit()
