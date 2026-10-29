"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { PaginationBar } from "./pagination-bar";
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
  // Extra classes for this column's header and cells (width, font size, padding).
  className?: string;
  // Smaller second line under the header label (e.g. "Previous Quarter").
  subLabel?: string;
  // Extra classes for the header cell only (e.g. a smaller header font).
  headerClassName?: string;
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
  pageSize,
  flush = false,
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
  // When set, rows are paginated client-side with a PaginationBar below the grid.
  pageSize?: number;
  // Edge-to-edge inside a panel (no own border / rounding) with the tighter rows
  // of the GovOne RAG grids (GovernanceMatrix) — for grids under an AccentSection.
  flush?: boolean;
}) {
  const showActions = !!(onEdit || onDelete);
  const [pendingDelete, setPendingDelete] = React.useState<T | null>(null);
  const [skip, setSkip] = React.useState(0);
  // Deleting rows (or a shrinking list) can leave skip past the end — clamp to the last page.
  const effectiveSkip = pageSize && skip >= items.length ? Math.max(0, Math.floor((items.length - 1) / pageSize) * pageSize) : skip;
  const visibleItems = pageSize ? items.slice(effectiveSkip, effectiveSkip + pageSize) : items;

  return (
    <div className={cn("overflow-x-auto", !flush && "rounded-lg border border-[#D0D9E2]")}>
      <table className={cn("w-full text-sm", flush && "text-left")}>
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
                className={cn("px-4 py-3", c.align === "right" && "text-right", c.className, c.headerClassName)}
              >
                {c.label}
                {c.subLabel ? (
                  <span className="block text-[0.9em] font-semibold tracking-normal normal-case opacity-70">{c.subLabel}</span>
                ) : null}
              </th>
            ))}
            {showActions ? <th className="px-4 py-3 text-right">Actions</th> : null}
          </tr>
        </thead>
        <tbody className={cn("text-[#172033]", !flush && "divide-y divide-[#E4E9EE]")}>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (showActions ? 1 : 0)}
                className={flush ? "px-5 py-4 text-slate-400" : "px-4 py-6 text-center text-[#526273]"}
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            visibleItems.map((item) => (
              <tr
                key={item.id}
                data-row-key={item.id}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn(
                  "bg-white even:bg-[#F8FAFB] hover:bg-[#EDF3F7]",
                  flush && "border-b border-[#E4E9EE] last:border-b-0",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4",
                      flush ? "py-2.5" : "py-3",
                      c.align === "right" && "text-right tabular-nums",
                      c.className
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
      {pageSize && items.length > pageSize ? (
        <PaginationBar skip={effectiveSkip} limit={pageSize} total={items.length} onPageChange={setSkip} />
      ) : null}
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
