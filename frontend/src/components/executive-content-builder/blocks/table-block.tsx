"use client";

import { ClipboardPaste, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockActions } from "../block-actions";
import type { TableBlock } from "../types";
import { ClipboardPermissionError, readClipboardTableSource } from "@/lib/clipboard-api";
import { parseClipboardTable } from "@/lib/clipboard-table-parse";

// Deliberately plain controlled <input> cells (not contentEditable) for
// predictable state, and no grid library — this is a small KPI/summary
// table, not a spreadsheet.
export function TableBlockEditor({
  block,
  onChange,
  ...actions
}: {
  block: TableBlock;
  onChange: (patch: Partial<Pick<TableBlock, "columns" | "rows">>) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const setColumnName = (colIndex: number, name: string) => {
    const columns = block.columns.map((c, i) => (i === colIndex ? name : c));
    onChange({ columns });
  };

  const setCell = (rowIndex: number, colIndex: number, value: string) => {
    const rows = block.rows.map((row, r) => (r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row));
    onChange({ rows });
  };

  const addRow = () => {
    onChange({ rows: [...block.rows, block.columns.map(() => "")] });
  };

  const deleteRow = (rowIndex: number) => {
    onChange({ rows: block.rows.filter((_, r) => r !== rowIndex) });
  };

  const addColumn = () => {
    onChange({
      columns: [...block.columns, `Column ${block.columns.length + 1}`],
      rows: block.rows.map((row) => [...row, ""]),
    });
  };

  const deleteColumn = (colIndex: number) => {
    onChange({
      columns: block.columns.filter((_, i) => i !== colIndex),
      rows: block.rows.map((row) => row.filter((_, i) => i !== colIndex)),
    });
  };

  // Replaces the whole table with a pasted Excel range. Only hijacks the
  // paste when multiple cells are involved — a single pasted value falls
  // through to the focused cell's normal single-value paste, so pasting one
  // number into one cell never wipes out the rest of the table.
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!e.clipboardData) return;
    const html = e.clipboardData.getData("text/html") || undefined;
    const text = e.clipboardData.getData("text/plain") || undefined;
    const parsed = parseClipboardTable(html, text);
    if (!parsed) return;

    if (parsed.columns.length <= 1 && parsed.rows.length <= 1 && (parsed.rows[0]?.length ?? 0) <= 1) return;

    e.preventDefault();
    onChange({ columns: parsed.columns, rows: parsed.rows });
    if (parsed.hadMergedCells) {
      toast.info("Merged cells were converted to standard table cells.");
    }
  };

  // Explicit button click, not a paste landing on a focused cell — always
  // applies the full parsed result (no single-cell fall-through to guard).
  const handlePasteClick = async () => {
    try {
      const source = await readClipboardTableSource();
      const parsed = source ? parseClipboardTable(source.html, source.text) : null;
      if (!parsed) {
        toast.info("No table data found on clipboard.");
        return;
      }
      onChange({ columns: parsed.columns, rows: parsed.rows });
      if (parsed.hadMergedCells) {
        toast.info("Merged cells were converted to standard table cells.");
      }
    } catch (err) {
      if (err instanceof ClipboardPermissionError) {
        toast.error("Clipboard access was blocked — press Ctrl+V instead.");
      } else {
        console.error("Paste Table failed:", err);
        toast.error("Couldn't read the clipboard — try Ctrl+V instead.");
      }
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-end border-b border-slate-100 bg-slate-50 px-1.5 py-1">
        <BlockActions {...actions} />
      </div>

      <div className="overflow-x-auto p-4" onPaste={handlePaste}>
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              {block.columns.map((col, colIndex) => (
                <th key={colIndex} className="min-w-32 text-left">
                  <div className="flex items-center gap-1">
                    <Input
                      value={col}
                      onChange={(e) => setColumnName(colIndex, e.target.value)}
                      className="h-8 font-bold"
                      aria-label={`Column ${colIndex + 1} name`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete column ${colIndex + 1}`}
                      disabled={block.columns.length <= 1}
                      onClick={() => deleteColumn(colIndex)}
                    >
                      <X className="size-3.5 text-slate-400" />
                    </Button>
                  </div>
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, colIndex) => (
                  <td key={colIndex}>
                    <Input
                      value={cell}
                      onChange={(e) => setCell(rowIndex, colIndex, e.target.value)}
                      className="h-8"
                      aria-label={`Row ${rowIndex + 1}, ${block.columns[colIndex] || `Column ${colIndex + 1}`}`}
                    />
                  </td>
                ))}
                <td>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete row ${rowIndex + 1}`}
                    disabled={block.rows.length <= 1}
                    onClick={() => deleteRow(rowIndex)}
                  >
                    <X className="size-3.5 text-slate-400" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="size-3.5" />
            Add Row
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addColumn}>
            <Plus className="size-3.5" />
            Add Column
          </Button>
          <Button type="button" variant="default" size="sm" onClick={handlePasteClick}>
            <ClipboardPaste className="size-3.5" />
            Paste Table
          </Button>
        </div>
      </div>
    </div>
  );
}
