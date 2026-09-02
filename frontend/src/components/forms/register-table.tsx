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
}: {
  items: T[];
  columns: RegisterColumn<T>[];
  emptyLabel: string;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onRowClick?: (item: T) => void;
}) {
  const showActions = !!(onEdit || onDelete);
  const [pendingDelete, setPendingDelete] = React.useState<T | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-600 uppercase">
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
        <tbody className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (showActions ? 1 : 0)}
                className="px-4 py-6 text-center text-slate-400"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr
                key={item.id}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={onRowClick ? "cursor-pointer hover:bg-slate-50" : undefined}
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
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#1a6fc4]"
                        >
                          <Pencil className="size-4" />
                        </button>
                      ) : null}
                      {onDelete ? (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(item)}
                          aria-label="Delete row"
                          className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
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
