"use client";

import * as React from "react";
import { ClipboardPaste, FileDown, FileUp } from "lucide-react";
import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ClipboardPermissionError, readClipboardTableSource } from "@/lib/clipboard-api";
import { parseClipboardTable } from "@/lib/clipboard-table-parse";
import { exportTemplate, parseExcelFile } from "@/lib/excel-io";
import { matchAndValidateRows, type MatchedRow, type ParsedGrid } from "@/lib/register-import-match";
import type { FieldDef } from "./entry-form";
import { RegisterImportDialog } from "./register-import-dialog";

const ROW_CAP = 200;

export function RegisterImportToolbar<TPayload>({
  defs,
  itemLabelPlural,
  buildPayload,
  createMutation,
}: {
  defs: FieldDef[];
  itemLabelPlural: string;
  buildPayload: (values: Record<string, string>) => TPayload;
  createMutation: Pick<UseMutationResult<unknown, unknown, TPayload>, "mutateAsync">;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [dialogState, setDialogState] = React.useState<{
    rows: MatchedRow[];
    truncatedCount?: number;
  } | null>(null);

  const openPreview = (grid: ParsedGrid) => {
    const truncatedCount = grid.rows.length > ROW_CAP ? grid.rows.length - ROW_CAP : undefined;
    const cappedGrid: ParsedGrid = truncatedCount ? { ...grid, rows: grid.rows.slice(0, ROW_CAP) } : grid;
    const rows = matchAndValidateRows(defs, cappedGrid);
    setDialogState({ rows, truncatedCount });
  };

  const handlePasteClick = async () => {
    try {
      const source = await readClipboardTableSource();
      const parsed = source ? parseClipboardTable(source.html, source.text) : null;
      if (!parsed) {
        toast.info("No table data found on clipboard.");
        return;
      }
      openPreview(parsed);
    } catch (err) {
      if (err instanceof ClipboardPermissionError) {
        toast.error("Clipboard access was blocked — press Ctrl+V instead.");
      } else {
        console.error("Paste from Excel failed:", err);
        toast.error("Couldn't read the clipboard.");
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    try {
      const parsed = await parseExcelFile(file);
      openPreview(parsed);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't read this file — make sure it's a valid .xlsx export from Excel."
      );
    }
  };

  const handleExportTemplate = () => {
    exportTemplate(`${itemLabelPlural}-template.xlsx`, defs.map((d) => d.label));
  };

  return (
    <>
      <div className="mb-4 flex justify-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          hidden
          onChange={handleFileChange}
        />
        <Button type="button" variant="outline" size="sm" onClick={handleExportTemplate}>
          <FileDown className="size-3.5" />
          Export Template
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <FileUp className="size-3.5" />
          Import Excel
        </Button>
        <Button type="button" variant="default" size="sm" onClick={handlePasteClick}>
          <ClipboardPaste className="size-3.5" />
          Paste from Excel
        </Button>
      </div>

      {dialogState ? (
        <RegisterImportDialog
          open={dialogState !== null}
          onOpenChange={(open) => {
            if (!open) setDialogState(null);
          }}
          itemLabelPlural={itemLabelPlural}
          defs={defs}
          rows={dialogState.rows}
          truncatedCount={dialogState.truncatedCount}
          buildPayload={buildPayload}
          createMutation={createMutation}
        />
      ) : null}
    </>
  );
}
