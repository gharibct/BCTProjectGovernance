// Client-side Excel file read/write via the xlsx (SheetJS) package. No
// backend involvement — .xlsx files are parsed and generated entirely in
// the browser.

import * as XLSX from "xlsx";
import { shapeGrid, type ShapedGrid } from "./table-grid-shape";

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
