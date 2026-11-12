// Client-side Excel file read/write via the xlsx (SheetJS) package. No
// backend involvement — .xlsx files are parsed and generated entirely in
// the browser.

import * as XLSX from "xlsx";
import type { FieldDef } from "@/components/forms/entry-form";
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

// Header colour per column type (ARGB). Labels stay exact — import matches on them.
const HEADER_FILL = {
  text: "FF475569", // slate
  date: "FF7C3AED", // purple
  decimal: "FF2563EB", // blue
  integer: "FF0D9488", // teal
  select: "FFD97706", // amber
} as const;
type HeaderType = keyof typeof HEADER_FILL;
const HEADER_LEGEND: Record<HeaderType, string> = {
  text: "Text",
  date: "Date (yyyy-mm-dd)",
  decimal: "Decimal number",
  integer: "Whole number",
  select: "Dropdown - pick from the list",
};
const TEMPLATE_ROWS = 1000;

function selectValues(def: FieldDef): string[] {
  if (def.kind !== "select") return [];
  return def.choices ? def.choices.map((c) => c.label) : [...(def.options ?? [])];
}

function headerType(def: FieldDef): HeaderType {
  if (def.kind === "select" && selectValues(def).length > 0) return "select";
  if (def.kind === "date") return "date";
  if (def.kind === "number") return def.integer ? "integer" : "decimal";
  return "text";
}

// Template: coloured, frozen header row (colour = data type), number/date
// formats, and an in-cell dropdown for every select field (values held on a
// hidden "Lists" sheet so long lists and commas in names are safe).
export async function exportTemplate(filename: string, defs: FieldDef[]): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Template", { views: [{ state: "frozen", ySplit: 1 }] });
  const lists = wb.addWorksheet("Lists", { state: "hidden" });

  defs.forEach((def, i) => {
    const col = i + 1;
    const type = headerType(def);
    const column = ws.getColumn(col);
    column.width = Math.max(14, def.label.length + 4);

    const head = ws.getCell(1, col);
    head.value = def.label;
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL[type] } };
    head.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    if (def.mandatory) {
      head.border = { bottom: { style: "thick", color: { argb: "FFDC2626" } } };
    }

    if (type === "date") column.numFmt = "yyyy-mm-dd";
    else if (type === "integer") column.numFmt = "0";
    else if (type === "decimal") column.numFmt = "#,##0.00";

    if (type === "select") {
      const values = selectValues(def);
      values.forEach((v, r) => {
        lists.getCell(r + 1, col).value = v;
      });
      const letter = column.letter;
      const listRef = `Lists!$${letter}$1:$${letter}$${values.length}`;
      for (let r = 2; r <= TEMPLATE_ROWS + 1; r++) {
        ws.getCell(r, col).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [listRef],
          showErrorMessage: true,
          errorStyle: "stop",
          errorTitle: "Invalid value",
          error: "Pick a value from the dropdown list.",
        };
      }
    } else if (type === "integer") {
      for (let r = 2; r <= TEMPLATE_ROWS + 1; r++) {
        ws.getCell(r, col).dataValidation = {
          type: "whole",
          operator: "between",
          allowBlank: true,
          formulae: [-2147483648, 2147483647],
          showErrorMessage: true,
          errorTitle: "Whole number",
          error: "Enter a whole number.",
        };
      }
    }
  });
  ws.getRow(1).height = 30;

  const legend = wb.addWorksheet("Legend");
  legend.getColumn(1).width = 8;
  legend.getColumn(2).width = 40;
  (Object.keys(HEADER_FILL) as HeaderType[]).forEach((t, i) => {
    legend.getCell(i + 1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL[t] } };
    legend.getCell(i + 1, 2).value = HEADER_LEGEND[t];
  });
  legend.getCell(6, 2).value = "Red underline on a header = mandatory";

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
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
