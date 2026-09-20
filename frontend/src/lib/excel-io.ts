// Client-side Excel file read/write via the xlsx (SheetJS) package. No
// backend involvement — .xlsx files are parsed and generated entirely in
// the browser.

import * as XLSX from "xlsx";
import { shapeGrid, type ShapedGrid } from "./table-grid-shape";
import { normalize } from "./register-import-match";

// Reads the first worksheet only (same "first table only" convention as
// clipboard-table-parse.ts) — no sheet picker. cellDates + dateNF makes
// genuine Excel date cells arrive pre-formatted as ISO strings, so
// register-import-match.ts's date coercion is a fallback for cells typed
// as plain text, not the primary path.
export async function parseExcelFile(file: File): Promise<ShapedGrid> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("This workbook has no sheets.");

  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    raw: false,
    dateNF: "yyyy-mm-dd",
    defval: "",
  }) as string[][];

  const shaped = shapeGrid(raw);
  if (!shaped) throw new Error("This file doesn't contain any data.");
  return shaped;
}

// Headers-only template — no data rows, no formulas/validation/formatting.
export function exportTemplate(filename: string, headers: string[]): void {
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

// Data export — a header row plus one row per record, written as a plain
// .xlsx (no formulas/formatting). Counterpart to exportTemplate, used by the
// Project Health grids' "Download to Excel" action.
export function exportRowsToExcel(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const aoa = [headers, ...rows.map((row) => row.map((cell) => cell ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

// Predefined-template lookup: the backend serves a hand-formatted
// "<slug>-template.xlsx" when one has been dropped in its import_templates
// folder (404 otherwise). Slug = the plural item label, lower-cased, with
// non-alphanumerics collapsed to "-".
export function templateSlug(itemLabelPlural: string): string {
  return itemLabelPlural
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Sheet 1 / row 1 of a workbook — the row the importer matches columns against.
export function templateHeaders(buf: ArrayBuffer): string[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as string[][];
  return (rows[0] ?? []).map(String);
}

// A custom template is usable only if it still has a column for every current
// field label. Extra columns and a different order are fine (import matches by
// label), so this catches a stale template after a field was added/renamed.
export function templateCoversLabels(headers: string[], labels: string[]): boolean {
  const present = new Set(headers.map(normalize));
  return labels.every((label) => present.has(normalize(label)));
}

export type TemplateDownload =
  | { kind: "custom"; blob: Blob }
  | { kind: "stale" }
  | { kind: "none" };

export async function fetchCustomTemplate(itemLabelPlural: string, labels: string[]): Promise<TemplateDownload> {
  try {
    const res = await fetch(`/api/v1/import-templates/${templateSlug(itemLabelPlural)}`, {
      credentials: "include",
      headers: { "X-API-Key": process.env.NEXT_PUBLIC_API_KEY ?? "" },
    });
    if (!res.ok) return { kind: "none" };
    const buf = await res.arrayBuffer();
    if (!templateCoversLabels(templateHeaders(buf), labels)) return { kind: "stale" };
    return { kind: "custom", blob: new Blob([buf], { type: res.headers.get("content-type") ?? undefined }) };
  } catch {
    return { kind: "none" };
  }
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
