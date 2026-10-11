"""Schema introspection for the master-data Excel tooling: turns the live
SQLAlchemy model metadata into a flat, already-decided list of
(table, included columns, required-ness, FK targets, business key) that the
generator, importer, and nullable-change proposal scripts all share, so
there is exactly one place that decides what a table "looks like" for this
tool.
"""

from __future__ import annotations

import dataclasses
import datetime as dt

from sqlalchemy import FetchedValue
from sqlalchemy.sql.schema import Column, Table

# Importing the router forces every app/models/*.py module to load
# (models/__init__.py is intentionally empty — see scripts/bootstrap_sqlite.py
# for the same trick), which is what actually populates Base.metadata.
from app.api.v1.router import api_router  # noqa: F401
from app.core.db import Base
from app.master_data.business_keys import BUSINESS_KEYS, GENERATED_CODE_COLUMN, Local, Ref
from app.master_data.enum_columns import ENUM_COLUMNS
from app.master_data.registry import ALWAYS_EXCLUDED_COLUMNS, EXCLUDED_TABLES, EXTRA_EXCLUDED_COLUMNS

_ACRONYMS = {"pci", "fte", "sla", "mttr", "uat", "sdlc", "de", "cxo", "id", "mfa"}
# Column names generic enough (reused across many tables) that a lookup label
# needs the owning table's name folded in too, e.g. "Period Code" rather than
# just "Code" — otherwise a composite key like measurement_development's
# (Project Code, Code) is ambiguous about what the second "Code" even is.
_GENERIC_KEY_COLUMNS = {"code", "name"}


def humanize(column_name: str) -> str:
    return " ".join(w.upper() if w in _ACRONYMS else w.capitalize() for w in column_name.split("_"))


def _fk_column_label(fk_column: str) -> str:
    """Header text for an FK column — strip a trailing "_id" so the sheet
    never implies a raw id is expected (e.g. "project_id" -> "Project", not
    "Project ID"); columns without that suffix (owner, identified_by, ...)
    are already descriptive as-is."""
    base = fk_column[:-3] if fk_column.endswith("_id") else fk_column
    return humanize(base)


def _singular_table_label(table_name: str) -> str:
    words = table_name.split("_")
    if words[-1].endswith("s") and not words[-1].endswith("ss"):
        words[-1] = words[-1][:-1]
    return humanize("_".join(words))


def fk_target_table(table_name: str, fk_column: str) -> str:
    table = Base.metadata.tables[table_name]
    (fk,) = table.columns[fk_column].foreign_keys
    return fk.column.table.name


@dataclasses.dataclass(frozen=True)
class ResolvedKeyPart:
    """One physically-real column backing a (possibly composite, possibly
    FK-indirect) business key, with the human label it should show under on
    whichever sheet is referencing it."""

    label: str
    table: str
    column: str


def resolve_key_parts(table_name: str) -> list[ResolvedKeyPart]:
    """Flatten a table's BUSINESS_KEYS entry into physically-grounded
    columns, following Ref() parts through as many FK hops as needed. Empty
    for a table with no business key at all (see business_keys.py)."""
    resolved: list[ResolvedKeyPart] = []
    for part in BUSINESS_KEYS.get(table_name, ()):
        if isinstance(part, Local):
            label = humanize(part.column)
            if part.column in _GENERIC_KEY_COLUMNS:
                label = f"{_singular_table_label(table_name)} {label}"
            resolved.append(ResolvedKeyPart(label=label, table=table_name, column=part.column))
        elif isinstance(part, Ref):
            resolved.extend(resolve_key_parts(fk_target_table(table_name, part.fk_column)))
    return resolved


@dataclasses.dataclass
class ColumnSpec:
    name: str
    column: Column
    required: bool
    is_own_business_key: bool


@dataclasses.dataclass
class FkExpansion:
    """A single FK column on a table, expanded into the 1+ sheet columns
    needed to type in the target row's business key instead of a raw id."""

    fk_column: str
    required: bool
    target_table: str
    key_parts: list[ResolvedKeyPart]


@dataclasses.dataclass
class TableSpec:
    name: str
    table: Table
    plain_columns: list[ColumnSpec]
    fk_expansions: list[FkExpansion]
    business_key: list[ResolvedKeyPart]
    generated_code_column: str | None


def _is_computed(column: Column) -> bool:
    return isinstance(column.server_default, FetchedValue)


def _build_table_spec(table: Table) -> TableSpec:
    extra_excluded = EXTRA_EXCLUDED_COLUMNS.get(table.name, frozenset())
    own_local_key_columns = {p.column for p in BUSINESS_KEYS.get(table.name, ()) if isinstance(p, Local)}

    plain_columns: list[ColumnSpec] = []
    fk_expansions: list[FkExpansion] = []

    for column in table.columns:
        if column.name in ALWAYS_EXCLUDED_COLUMNS or column.name in extra_excluded or _is_computed(column):
            continue

        if column.foreign_keys:
            target_table = fk_target_table(table.name, column.name)
            key_parts = resolve_key_parts(target_table)
            if not key_parts:
                raise ValueError(
                    f"{table.name}.{column.name} references {target_table!r}, which has no "
                    "BUSINESS_KEYS entry in app/master_data/business_keys.py — add one, or add "
                    "this column to EXTRA_EXCLUDED_COLUMNS if it should never be entered."
                )
            fk_expansions.append(
                FkExpansion(
                    fk_column=column.name,
                    required=not column.nullable,
                    target_table=target_table,
                    key_parts=key_parts,
                )
            )
            continue

        plain_columns.append(
            ColumnSpec(
                name=column.name,
                column=column,
                required=not column.nullable,
                is_own_business_key=column.name in own_local_key_columns,
            )
        )

    return TableSpec(
        name=table.name,
        table=table,
        plain_columns=plain_columns,
        fk_expansions=fk_expansions,
        business_key=resolve_key_parts(table.name),
        generated_code_column=GENERATED_CODE_COLUMN.get(table.name),
    )


def discover_tables() -> list[TableSpec]:
    """All included tables, in Base.metadata.sorted_tables order — already
    FK-topologically sorted (parents before children), which doubles as both
    the sheet tab order and the safe processing order for import."""
    return [_build_table_spec(t) for t in Base.metadata.sorted_tables if t.name not in EXCLUDED_TABLES]


def build_sheet_titles(table_specs: list[TableSpec]) -> dict[str, str]:
    """table name -> Excel sheet title, truncated to Excel's 31-char sheet
    name limit (a handful of measurement_*/metric_target_* tables exceed it)
    while staying unique and stable, so the generator and importer agree."""
    titles: dict[str, str] = {}
    used: set[str] = set()
    for spec in table_specs:
        title = spec.name[:31]
        if title in used:
            suffix = 1
            while f"{title[:29]}_{suffix}" in used:
                suffix += 1
            title = f"{title[:29]}_{suffix}"
        used.add(title)
        titles[spec.name] = title
    return titles


@dataclasses.dataclass(eq=False)
class SheetColumn:
    """One physical column on a table's sheet — either a plain DB column, or
    one part of an FK's business-key expansion. The generator uses this to
    write headers/notes/validation; the importer uses the identical list to
    parse cells back, keyed by header text, so the two can never drift apart.

    eq=False keeps the default identity-based hash (each instance from one
    build_sheet_columns() call is used as a dict key within that same call
    only, so identity equality is exactly what's needed — value equality
    would also require hashing the nested ColumnSpec/FkExpansion/
    ResolvedKeyPart dataclasses, which carry a live SQLAlchemy Column)."""

    header: str
    required: bool
    note: str | None
    list_key: str | None  # key into generate_template's Lists sheet (enum name, or "YN")
    plain: ColumnSpec | None = None
    fk: FkExpansion | None = None
    fk_part: ResolvedKeyPart | None = None


def build_sheet_columns(spec: TableSpec) -> list[SheetColumn]:
    columns: list[SheetColumn] = []

    for col in spec.plain_columns:
        note_parts: list[str] = []
        list_key: str | None = None
        if col.is_own_business_key:
            note_parts.append("This table's lookup key for import.")
            if spec.generated_code_column == col.name:
                note_parts.append("Blank = auto-generate a new code.")
        enum_cls = ENUM_COLUMNS.get(spec.name, {}).get(col.name)
        py_type = col.column.type.python_type
        if enum_cls is not None:
            list_key = enum_cls.__name__
            note_parts.append("Allowed values: " + ", ".join(v.value for v in enum_cls))
        elif py_type is bool:
            list_key = "YN"
            note_parts.append("Enter Y or N.")
        elif py_type in (dt.date, dt.datetime):
            note_parts.append("Enter a date as YYYY-MM-DD.")
        columns.append(
            SheetColumn(
                header=humanize(col.name),
                required=col.required,
                note=" ".join(note_parts) or None,
                list_key=list_key,
                plain=col,
            )
        )

    for fk in spec.fk_expansions:
        labels = ", ".join(p.label for p in fk.key_parts)
        note = f"References the '{fk.target_table}' sheet — enter its {labels}, not an id."
        fk_label = _fk_column_label(fk.fk_column)
        if len(fk.key_parts) == 1:
            columns.append(
                SheetColumn(
                    header=fk_label,
                    required=fk.required,
                    note=note,
                    list_key=None,
                    fk=fk,
                    fk_part=fk.key_parts[0],
                )
            )
        else:
            for part in fk.key_parts:
                columns.append(
                    SheetColumn(
                        header=f"{fk_label} - {part.label}",
                        required=fk.required,
                        note=note,
                        list_key=None,
                        fk=fk,
                        fk_part=part,
                    )
                )

    return columns


def used_lists(table_specs: list[TableSpec]) -> dict[str, list[str]]:
    used: dict[str, list[str]] = {"YN": ["Y", "N"]}
    for spec in table_specs:
        for col in spec.plain_columns:
            enum_cls = ENUM_COLUMNS.get(spec.name, {}).get(col.name)
            if enum_cls is not None:
                used[enum_cls.__name__] = [v.value for v in enum_cls]
    return used
