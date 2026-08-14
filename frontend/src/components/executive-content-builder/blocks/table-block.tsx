"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockActions } from "../block-actions";
import type { TableBlock } from "../types";

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

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-end border-b border-slate-100 bg-slate-50 px-1.5 py-1">
        <BlockActions {...actions} />
      </div>

      <div className="overflow-x-auto p-4">
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
        </div>
      </div>
    </div>
  );
}
