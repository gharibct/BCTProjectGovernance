"use client";

import * as React from "react";
import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FieldDef } from "./entry-form";
import type { MatchedRow } from "@/lib/register-import-match";

export function RegisterImportDialog<TPayload>({
  open,
  onOpenChange,
  itemLabelPlural,
  defs,
  rows,
  truncatedCount,
  buildPayload,
  createMutation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabelPlural: string;
  defs: FieldDef[];
  rows: MatchedRow[];
  truncatedCount?: number;
  buildPayload: (values: Record<string, string>) => TPayload;
  createMutation: Pick<UseMutationResult<unknown, unknown, TPayload>, "mutateAsync">;
}) {
  const [busy, setBusy] = React.useState(false);
  // Rows already created in a prior confirm click this session (kept so a
  // retry after a partial failure only re-attempts what actually failed).
  const [succeededIndexes, setSucceededIndexes] = React.useState<Set<number>>(new Set());
  const [failMessages, setFailMessages] = React.useState<Map<number, string>>(new Map());

  // A fresh batch (new `rows` reference from a new paste/import) resets
  // everything — adjusted during render (React's documented pattern for
  // resetting state when a prop changes) rather than in an effect, so there
  // isn't a stale-state render in between.
  const [prevRows, setPrevRows] = React.useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setSucceededIndexes(new Set());
    setFailMessages(new Map());
  }

  const parseInvalidCount = rows.filter((r) => Object.keys(r.errors).length > 0).length;
  const toCreate = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row, index }) => Object.keys(row.errors).length === 0 && !succeededIndexes.has(index));

  const handleConfirm = async () => {
    setBusy(true);
    const newFailures = new Map<number, string>();
    const newSucceeded = new Set(succeededIndexes);
    for (const { row, index } of toCreate) {
      try {
        await createMutation.mutateAsync(buildPayload(row.values));
        newSucceeded.add(index);
      } catch (err) {
        newFailures.set(index, err instanceof Error ? err.message : "Failed to create this row.");
      }
    }
    setSucceededIndexes(newSucceeded);
    setFailMessages(newFailures);
    setBusy(false);

    if (newFailures.size === 0) {
      toast.success(`${newSucceeded.size} ${itemLabelPlural.toLowerCase()} imported.`);
      onOpenChange(false);
    } else {
      toast.error(
        `${newSucceeded.size - succeededIndexes.size} row(s) saved, ${newFailures.size} failed — fix and retry, or cancel.`
      );
    }
  };

  // Rows already created drop out of the preview entirely; everything else
  // (still-invalid or failed-last-attempt) stays visible for review/retry.
  const visibleRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ index }) => !succeededIndexes.has(index));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import {itemLabelPlural}</DialogTitle>
          <DialogDescription>
            {toCreate.length} of {rows.length} row{rows.length === 1 ? "" : "s"} are ready to import
            {parseInvalidCount > 0 ? `; ${parseInvalidCount} have errors and will be skipped` : ""}.
            {truncatedCount
              ? ` Only the first ${rows.length} rows are shown; ${truncatedCount} row(s) were dropped — split large imports into multiple files.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-600 uppercase">
                <th className="px-3 py-2">Status</th>
                {defs.map((d) => (
                  <th key={d.key} className="px-3 py-2">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={defs.length + 1} className="px-3 py-6 text-center text-slate-400">
                    Nothing left to import.
                  </td>
                </tr>
              ) : (
                visibleRows.map(({ row, index }) => {
                  const parseError = Object.values(row.errors)[0];
                  const failMessage = failMessages.get(index);
                  const message = parseError ?? failMessage;
                  return (
                    <tr key={index} className={message ? "bg-red-50/60" : undefined}>
                      <td className="px-3 py-2 align-top text-xs">
                        {message ? (
                          <span className="font-medium text-red-600">{message}</span>
                        ) : (
                          <span className="text-emerald-600">Ready</span>
                        )}
                      </td>
                      {defs.map((d) => (
                        <td key={d.key} className="px-3 py-2 align-top whitespace-nowrap">
                          {row.values[d.key] || "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy || toCreate.length === 0}>
            {busy ? <ButtonSpinner /> : null}
            Create {toCreate.length} row{toCreate.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
