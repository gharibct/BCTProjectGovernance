"use client";

import * as React from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { RegisterColumn } from "@/components/forms/register-table";
import { exportRowsToExcel } from "@/lib/excel-io";

// "Download to Excel" action shared by every Project Health drill-down grid.
// Pulls the full filtered result set via fetchAll (not just the on-screen
// page) and writes it to an .xlsx, using each column's label as the header
// and its excelValue() — or item[key] — as the cell text.
export function ProjectHealthExportButton<T extends Record<string, unknown>>({
  filename,
  columns,
  fetchAll,
}: {
  filename: string;
  columns: RegisterColumn<T>[];
  fetchAll: () => Promise<T[]>;
}) {
  const [busy, setBusy] = React.useState(false);

  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const data = await fetchAll();
      if (data.length === 0) {
        toast.info("Nothing to export.");
        return;
      }
      const headers = columns.map((c) => c.label);
      const rows = data.map((item) =>
        columns.map((c) => {
          const value = c.excelValue ? c.excelValue(item) : (item[c.key] as unknown);
          if (value == null) return "";
          return typeof value === "number" ? value : String(value);
        }),
      );
      exportRowsToExcel(filename, headers, rows);
    } catch (err) {
      console.error("Excel export failed:", err);
      toast.error("Couldn't export to Excel.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={busy}
      className="shrink-0"
    >
      <FileDown className="size-3.5" />
      {busy ? "Exporting…" : "Download to Excel"}
    </Button>
  );
}
