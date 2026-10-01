"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { ConfirmationDialog } from "./confirmation-dialog";
import { StatusBadge } from "./status-badge";

export type RegisterColumn<T> = {
  key: string;
  label: string;
  align?: "right";
  badge?: boolean;
  render?: (item: T) => React.ReactNode;
  // Plain-text cell value for spreadsheet export (see exportRowsToExcel).
  // Falls back to item[key] when omitted — set it for columns whose
  // render() composes several fields into one cell.
  excelValue?: (item: T) => string | number | null | undefined;
};

// Shared list-view table for RAIDO registers (§4.5–4.9 of the spec): ID,
// Title, Category, Owner, Status, and Severity/Priority/Criticality/Impact
// with color coding — one component reused across all five logs (and the
// Contractual Compliance / Resource Allocation registers). onEdit/onDelete
// are optional — when passed, an Actions column with a pencil/trash icon
// per row appears; onEdit hands the row back so the caller can populate its
// "New <Item>" form for in-place editing.
export function RegisterTable<T extends { id: string } & Record<string, unknown>>({
  items,
  columns,
  emptyLabel,
  onEdit,
  onDelete,
  onRowClick,
  headerClassName,
}: {
  items: T[];
  columns: RegisterColumn<T>[];
  emptyLabel: string;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onRowClick?: (item: T) => void;
  // Override the default slate header tint so a view with several stacked
  // grey controls (tabs, filters) can give the grid header its own colour.
  headerClassName?: string;
}) {
  const showActions = !!(onEdit || onDelete);
  const [pendingDelete, setPendingDelete] = React.useState<T | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-[#D0D9E2]">
      <table className="w-full text-sm">
        <thead>
          <tr
            className={cn(
              "border-b border-[#8EBBE0] bg-[#D6E9F8] text-left text-xs font-bold tracking-wide text-[#205889] uppercase",
              headerClassName
            )}
          >
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn("px-4 py-3", c.align === "right" && "text-right")}
              >
                {c.label}
              </th>
            ))}
            {showActions ? <th className="px-4 py-3 text-right">Actions</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E4E9EE] text-[#172033]">
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (showActions ? 1 : 0)}
                className="px-4 py-6 text-center text-[#526273]"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr
                key={item.id}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn(
                  "bg-white even:bg-[#F8FAFB] hover:bg-[#EDF3F7]",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-3",
                      c.align === "right" && "text-right tabular-nums"
                    )}
                  >
                    {c.render ? (
                      c.render(item)
                    ) : c.badge ? (
                      <StatusBadge value={(item[c.key] as string) ?? ""} />
                    ) : (
                      (item[c.key] as string) || "—"
                    )}
                  </td>
                ))}
                {showActions ? (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {onEdit ? (
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          aria-label="Edit row"
                          className="rounded-md p-1.5 text-[#526273] hover:bg-[#EDF3F7] hover:text-[#1a6fc4]"
                        >
                          <Pencil className="size-4" />
                        </button>
                      ) : null}
                      {onDelete ? (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(item)}
                          aria-label="Delete row"
                          className="rounded-md p-1.5 text-[#526273] hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <ConfirmationDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this row?"
        message="This action cannot be undone."
        onConfirm={() => {
          if (pendingDelete) onDelete?.(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
