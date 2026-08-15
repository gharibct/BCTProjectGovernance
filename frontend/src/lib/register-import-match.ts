// Matches a parsed Excel/clipboard grid's header row against a register's
// FieldDef[] by name (never renaming the register's own field labels — the
// grid's headers are just a lookup key), then coerces and validates each
// data row per field kind. Pure — no React import.

import type { FieldDef } from "@/components/forms/entry-form";

export type ParsedGrid = { columns: string[]; rows: string[][] };
export type MatchedRow = { values: Record<string, string>; errors: Record<string, string> };

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

// Left-to-right over the incoming columns, matching each against the first
// unclaimed FieldDef whose label matches (checked before key, across all
// columns, so a label match always wins a tie against a key match found on
// a later column) — label match takes priority, key match is the fallback
// for pasting literal field keys. First occurrence wins on duplicate
// headers; later duplicates/no-match columns are simply ignored.
function matchColumnsToFields(defs: FieldDef[], columns: string[]): (FieldDef | null)[] {
  const normalizedColumns = columns.map(normalize);
  const claimed = new Set<string>();
  const result: (FieldDef | null)[] = new Array(columns.length).fill(null);

  // Pass 1: label matches (priority).
  normalizedColumns.forEach((col, i) => {
    if (!col || result[i]) return;
    const def = defs.find((d) => !claimed.has(d.key) && normalize(d.label) === col);
    if (def) {
      claimed.add(def.key);
      result[i] = def;
    }
  });

  // Pass 2: key matches (fallback), only for columns still unmatched.
  normalizedColumns.forEach((col, i) => {
    if (!col || result[i]) return;
    const def = defs.find((d) => !claimed.has(d.key) && normalize(d.key) === col);
    if (def) {
      claimed.add(def.key);
      result[i] = def;
    }
  });

  return result;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Tries a sequence of known Excel/display date formats before falling back
// to a locale-dependent Date parse, to keep the common cases deterministic.
function coerceDate(raw: string): { value: string; error?: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: "" };

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { value: trimmed };

  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return { value: `${y}-${pad2(Number(m))}-${pad2(Number(d))}` };
  }

  const dMonY = trimmed.match(/^(\d{1,2})-([A-Za-z]{3,9})-(\d{4})$/);
  if (dMonY) {
    const [, d, monName, y] = dMonY;
    const m = MONTHS[monName.slice(0, 3).toLowerCase()];
    if (m) return { value: `${y}-${pad2(m)}-${pad2(Number(d))}` };
  }

  const monDY = trimmed.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monDY) {
    const [, monName, d, y] = monDY;
    const m = MONTHS[monName.slice(0, 3).toLowerCase()];
    if (m) return { value: `${y}-${pad2(m)}-${pad2(Number(d))}` };
  }

  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) {
    return { value: `${fallback.getFullYear()}-${pad2(fallback.getMonth() + 1)}-${pad2(fallback.getDate())}` };
  }

  return { value: raw, error: "Unrecognized date format — expected YYYY-MM-DD." };
}

function coerceNumber(raw: string): { value: string; error?: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: "" };
  const stripped = trimmed.replace(/,/g, "");
  const n = Number(stripped);
  if (Number.isNaN(n)) return { value: raw, error: "Must be a number." };
  return { value: String(n) };
}

function coerceSelect(def: FieldDef, raw: string): { value: string; error?: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: "" };
  const norm = normalize(trimmed);

  if (def.choices) {
    const byLabel = def.choices.find((c) => normalize(c.label) === norm);
    if (byLabel) return { value: byLabel.value };
    const byValue = def.choices.find((c) => normalize(c.value) === norm);
    if (byValue) return { value: byValue.value };
    const validLabels = def.choices.map((c) => c.label).join(", ");
    return { value: raw, error: `"${raw}" is not a valid option — expected one of: ${validLabels}` };
  }

  if (def.options) {
    const match = def.options.find((o) => normalize(o) === norm);
    if (match) return { value: match };
    return { value: raw, error: `"${raw}" is not a valid option — expected one of: ${def.options.join(", ")}` };
  }

  return { value: trimmed };
}

function coerceCell(def: FieldDef, raw: string): { value: string; error?: string } {
  switch (def.kind) {
    case "number":
      return coerceNumber(raw);
    case "date":
      return coerceDate(raw);
    case "select":
      return coerceSelect(def, raw);
    default:
      return { value: raw.trim() };
  }
}

export function matchAndValidateRows(defs: FieldDef[], grid: ParsedGrid): MatchedRow[] {
  const columnMatches = matchColumnsToFields(defs, grid.columns);
  const colIndexByKey = new Map<string, number>();
  columnMatches.forEach((def, i) => {
    if (def) colIndexByKey.set(def.key, i);
  });

  return grid.rows
    .filter((row) => !isBlankRow(row))
    .map((row) => {
      const values: Record<string, string> = {};
      const errors: Record<string, string> = {};

      for (const def of defs) {
        const colIndex = colIndexByKey.get(def.key);
        const raw = colIndex !== undefined ? (row[colIndex] ?? "") : "";
        const { value, error } = coerceCell(def, raw);
        values[def.key] = value;
        if (error) errors[def.key] = error;
        else if (def.mandatory && !value.trim()) errors[def.key] = "This field is required.";
      }

      return { values, errors };
    });
}
