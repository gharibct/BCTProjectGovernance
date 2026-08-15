// Parses clipboard content (an Excel cell range) into a rectangular grid.
// Prefers clipboard HTML (so merged cells can be detected and flattened)
// and falls back to tab/newline-delimited plain text.
//
// Runs only in response to a user-triggered paste in a "use client"
// component; the parsed Document is only ever read via .textContent, never
// re-inserted into the live page, so there's no XSS/SSR concern.

import { shapeGrid } from "./table-grid-shape";

export type ClipboardTableResult = {
  columns: string[];
  rows: string[][];
  hadMergedCells: boolean;
};

// Excel's clipboard HTML represents a merged region as one cell with
// colSpan/rowSpan; every other position in that rectangle is simply absent
// from the DOM. This walks the table tracking which columns are still
// "carried" by a rowspan from an earlier row, and writes the cell's value
// only at the top-left origin of its span — every other position in the
// span is left "". Sufficient for Excel's regular rectangular merges; not a
// general irregular/overlapping-span solver.
function expandTableToGrid(table: HTMLTableElement): { grid: string[][]; hadMergedCells: boolean } {
  const trList = Array.from(table.rows);
  const grid: string[][] = [];
  const rowSpanCarry = new Map<number, number>();
  let hadMergedCells = false;

  trList.forEach((tr, rowIndex) => {
    grid[rowIndex] = grid[rowIndex] ?? [];
    const cells = Array.from(tr.cells);
    let cellPtr = 0;
    let colIndex = 0;

    while (cellPtr < cells.length || rowSpanCarry.has(colIndex)) {
      if (rowSpanCarry.has(colIndex)) {
        grid[rowIndex][colIndex] = grid[rowIndex][colIndex] ?? "";
        const remaining = rowSpanCarry.get(colIndex)!;
        if (remaining <= 1) rowSpanCarry.delete(colIndex);
        else rowSpanCarry.set(colIndex, remaining - 1);
        colIndex++;
        continue;
      }

      const cell = cells[cellPtr++];
      const text = (cell.textContent ?? "").trim();
      const colSpan = cell.colSpan || 1;
      const rowSpan = cell.rowSpan || 1;
      if (colSpan > 1 || rowSpan > 1) hadMergedCells = true;

      for (let dc = 0; dc < colSpan; dc++) {
        grid[rowIndex][colIndex + dc] = dc === 0 ? text : "";
        if (rowSpan > 1) rowSpanCarry.set(colIndex + dc, rowSpan - 1);
      }
      colIndex += colSpan;
    }
  });

  return { grid, hadMergedCells };
}

function tryParseHtml(html: string): { grid: string[][]; hadMergedCells: boolean } | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return null;
  return expandTableToGrid(table);
}

function parsePlainText(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.split("\t"));
}

export function parseClipboardTable(
  html: string | undefined,
  text: string | undefined
): ClipboardTableResult | null {
  const htmlResult = html ? tryParseHtml(html) : null;
  const rawGrid = htmlResult?.grid ?? (text ? parsePlainText(text) : null);
  if (!rawGrid) return null;

  const shaped = shapeGrid(rawGrid);
  if (!shaped) return null;

  return {
    ...shaped,
    hadMergedCells: htmlResult?.hadMergedCells ?? false,
  };
}
