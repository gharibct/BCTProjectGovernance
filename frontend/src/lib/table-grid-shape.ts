// Shared grid post-processing for anything that turns a raw 2D string array
// (from clipboard HTML, clipboard plain text, or a parsed Excel sheet) into
// a { columns, rows } shape: pad ragged rows, trim trailing blank rows/cols,
// then split the header row from the data rows. Used by both
// clipboard-table-parse.ts and excel-io.ts so paste and file-import produce
// identical grid shapes from identical logic.

export type ShapedGrid = { columns: string[]; rows: string[][] };

function isBlankCell(cell: string): boolean {
  return cell.trim() === "";
}

function isBlankRow(row: string[]): boolean {
  return row.every(isBlankCell);
}

function padRagged(grid: string[][]): string[][] {
  const maxCols = grid.reduce((max, row) => Math.max(max, row.length), 0);
  return grid.map((row) => (row.length < maxCols ? [...row, ...Array(maxCols - row.length).fill("")] : row));
}

function trimTrailingEmptyRows(grid: string[][]): string[][] {
  const trimmed = [...grid];
  while (trimmed.length > 0 && isBlankRow(trimmed[trimmed.length - 1])) {
    trimmed.pop();
  }
  return trimmed;
}

function trimTrailingEmptyColumns(grid: string[][]): string[][] {
  if (grid.length === 0) return grid;
  let lastCol = grid[0].length - 1;
  while (lastCol >= 0 && grid.every((row) => isBlankCell(row[lastCol] ?? ""))) {
    lastCol--;
  }
  return grid.map((row) => row.slice(0, lastCol + 1));
}

export function shapeGrid(rawGrid: string[][]): ShapedGrid | null {
  if (!rawGrid || rawGrid.length === 0) return null;

  const grid = trimTrailingEmptyColumns(trimTrailingEmptyRows(padRagged(rawGrid)));
  if (grid.length === 0 || grid[0].length === 0) return null;

  const [columns, ...rows] = grid;
  return {
    columns,
    rows: rows.length > 0 ? rows : [columns.map(() => "")],
  };
}
