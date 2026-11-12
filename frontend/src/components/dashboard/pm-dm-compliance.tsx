"use client";

import * as React from "react";
import { LayoutGrid } from "lucide-react";

import { ErrorBlock } from "@/components/dashboard/project-health-kpi";
import { NativeSelect } from "@/components/ui/native-select";
import { usePmDmCompliance, usePmDmCompliancePeriods, type PmDmComplianceCell, type PmDmComplianceRow } from "@/lib/api/pm-dm-compliance";
import { saveBlob } from "@/lib/excel-io";
import { sectionAccentColor } from "@/lib/section-accent-colors";
import { cn } from "@/lib/utils";

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
const fmtPct = (value: number | null) => (value === null ? "—" : `${value}%`);

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" });

// Same grid look as the High Risk Dashboard (governance-matrix.tsx): accent section header, blue
// uppercase header row, striped rows with a hover tint, hairline row dividers.
const th = "px-3 py-3 text-center";
const td = "px-3 py-2.5";

// PM / DM Compliance (design-reference/Governance-One-Adoption-Flash.xlsx):
// per person, weekly reports owed (as PM of projects / DM of accounts) vs
// submitted. The period combo lists completed weeks; the grid is a rolling
// 4-week score ending at the selected week.
export function PmDmCompliance() {
  const { data: periods = [], isLoading: periodsLoading } = usePmDmCompliancePeriods();
  const [selected, setSelected] = React.useState("");
  const [search, setSearch] = React.useState("");
  const periodId = selected || periods[0]?.id || "";
  const { data, isLoading, isError, error, refetch } = usePmDmCompliance(periodId || undefined, !!periodId);

  const accent = sectionAccentColor(0);
  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    // Fully compliant (every owed report filed, all on time) are hidden; only people needing attention show.
    const list = (data?.rows ?? []).filter(
      (r) => (!q || r.name.toLowerCase().includes(q)) && !(r.expected > 0 && r.submitted >= r.expected && r.on_time >= r.expected)
    );
    // Worst first: lowest on-time submission ratio, then name.
    const ratio = (r: PmDmComplianceRow) => (r.expected ? r.on_time / r.expected : 1);
    return [...list].sort((a, b) => ratio(a) - ratio(b) || a.name.localeCompare(b.name));
  }, [data, search]);

  const [exporting, setExporting] = React.useState(false);
  // Same colours as the on-screen grid: pink = pending, amber = late.
  const exportToExcel = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("PM-DM Compliance");
      const edge = { style: "thin" as const, color: { argb: "FFE2E8F0" } };
      const border = { top: edge, left: edge, bottom: edge, right: edge };
      const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
      const toneArgb = (v: number | null) =>
        v === null ? "FF94A3B8" : v >= 90 ? "FF059669" : v >= 70 ? "FFD97706" : "FFDC2626";

      const head = ws.addRow(["DM / PM", "Overall Submitted", "Ontime Submission", ...data.weeks.map((w) => dayLabel(w.end_date))]);
      head.height = 24;
      head.eachCell((c, col) => {
        c.font = { bold: true, color: { argb: "FF475569" } };
        c.fill = fill("FFF8FAFC");
        c.border = border;
        c.alignment = { vertical: "middle", horizontal: col === 1 ? "left" : "center", wrapText: true };
      });

      for (const r of rows) {
        const overall = pct(r.weeks_fully_submitted, r.weeks_owed);
        const onTime = pct(r.on_time, r.expected);
        const row = ws.addRow([
          r.name,
          fmtPct(overall),
          fmtPct(onTime),
          ...r.weeks.map((c) => (c.expected === 0 ? "—" : `${c.submitted} / ${c.expected}`)),
        ]);
        row.eachCell((c, col) => {
          c.border = border;
          c.alignment = { vertical: "middle", horizontal: col === 1 ? "left" : "center" };
        });
        row.getCell(2).font = { color: { argb: toneArgb(overall) } };
        row.getCell(3).font = { color: { argb: toneArgb(onTime) } };
        r.weeks.forEach((c, i) => {
          const state = cellState(c);
          if (state === "pending") row.getCell(4 + i).fill = fill("FFFFCCFF");
          else if (state === "late") row.getCell(4 + i).fill = fill("FFFDE68A");
        });
      }
      ws.getColumn(1).width = 32;
      ws.getColumn(2).width = 18;
      ws.getColumn(3).width = 18;
      data.weeks.forEach((_, i) => (ws.getColumn(4 + i).width = 14));
      ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

      const buf = await wb.xlsx.writeBuffer();
      saveBlob(
        new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `pm-dm-compliance-${data.period?.end_date ?? "latest"}.xlsx`
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">PM / DM Compliance</h1>
          <p className="mt-1.5 text-slate-500">
            Weekly reports expected vs submitted, per Project Manager and Delivery Manager
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex w-56 flex-col gap-1 text-xs font-semibold text-slate-600">
            Period (week ending)
            <NativeSelect
              value={periodId}
              onChange={(e) => setSelected(e.target.value)}
              disabled={periods.length === 0}
              aria-label="Period"
            >
              {periods.length === 0 ? (
                <option value="">{periodsLoading ? "Loading…" : "No completed weeks"}</option>
              ) : (
                periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))
              )}
            </NativeSelect>
          </label>
          <button
            type="button"
            onClick={exportToExcel}
            disabled={!data || rows.length === 0 || exporting}
            className="h-11 rounded-lg border border-[#5B9BE6] bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-[#F7FAFF] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export to Excel"}
          </button>
          <label className="flex w-56 flex-col gap-1 text-xs font-semibold text-slate-600">
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Person name"
              className="h-11 rounded-lg border border-[#5B9BE6] bg-[#F7FAFF] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            />
          </label>
        </div>
      </header>

      {isError ? (
        <ErrorBlock title="Couldn't load PM / DM Compliance." error={error} onRetry={() => refetch()} />
      ) : periods.length === 0 && !periodsLoading ? (
        <p className="text-slate-400">No completed reporting periods yet.</p>
      ) : isLoading || !data ? (
        <p className="text-slate-400">Loading…</p>
      ) : data.weeks.length === 0 ? (
        <p className="text-slate-400">No weekly reporting periods have ended up to {data.period?.label ?? "this period"}.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="People" value={String(data.summary.people)} />
            <Tile
              label="Fully compliant"
              value={`${data.summary.fully_compliant_people} / ${data.summary.people}`}
            />
            <Tile label="Submitted" value={`${data.summary.submitted_pct}%`} sub={`${data.summary.submitted} / ${data.summary.expected}`} />
            <Tile label="On time" value={`${data.summary.on_time_pct}%`} sub={`${data.summary.on_time} / ${data.summary.expected}`} />
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <h2
              className={cn("flex items-center gap-3 px-6 py-4 text-lg font-bold tracking-wide", accent.text)}
              style={{ backgroundColor: accent.bg }}
            >
              <LayoutGrid className="size-5 shrink-0" />
              {data.period ? `PM / DM Compliance — week ending ${dayLabel(data.period.end_date)}` : "PM / DM Compliance"}
            </h2>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#8EBBE0] bg-[#D6E9F8] text-xs font-bold tracking-wide text-[#205889] uppercase">
                  <th className={cn(th, "min-w-[220px] px-4 text-left")}>DM / PM</th>
                  <th className={th}>Overall Submitted</th>
                  <th className={th}>Ontime Submission</th>
                  {data.weeks.map((w) => (
                    <th key={w.period_id} className={th}>
                      {dayLabel(w.end_date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3 + data.weeks.length} className={cn(td, "text-center text-slate-400")}>
                      {search.trim() ? "No matching people." : "Everyone is fully compliant for this period."}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => <Row key={r.user_id} row={r} />)
                )}
              </tbody>
            </table>
            </div>
          </section>
          <div className="flex flex-col gap-2 text-xs text-slate-500">
            <p>
              Overall Submitted = weeks with every owed report filed. Ontime Submission = reports filed by the due date
              out of all reports owed. Cells show submitted / expected. Fully compliant people are hidden.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="font-semibold text-slate-600">Cell colours:</span>
              <Swatch className="bg-[#FFCCFF]" label="Pink — a report is still pending (not submitted)" />
              <Swatch className="bg-amber-200" label="Amber — all submitted, but some late (pink wins if both)" />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="font-semibold text-slate-600">Percentage colours:</span>
              <span className="font-semibold text-emerald-600">90% and above — Good</span>
              <span className="font-semibold text-amber-600">70% to 89% — Needs attention</span>
              <span className="font-semibold text-red-600">Below 70% — Poor</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ row }: { row: PmDmComplianceRow }) {
  const overall = pct(row.weeks_fully_submitted, row.weeks_owed);
  const onTime = pct(row.on_time, row.expected);
  return (
    <tr className="border-b border-[#E4E9EE] bg-white last:border-b-0 even:bg-[#F8FAFB] hover:bg-[#EDF3F7]">
      <td className={cn(td, "px-4 font-semibold text-slate-900")}>{row.name}</td>
      <td className={cn(td, "text-center", tone(overall))} title={`${row.weeks_fully_submitted} / ${row.weeks_owed} weeks`}>
        {fmtPct(overall)}
      </td>
      <td className={cn(td, "text-center", tone(onTime))} title={`${row.on_time} / ${row.expected} reports`}>
        {fmtPct(onTime)}
      </td>
      {row.weeks.map((c, i) => (
        <td
          key={i}
          className={cn(td, "text-center tabular-nums", cellShade(c))}
        >
          {c.expected === 0 ? "—" : `${c.submitted} / ${c.expected}`}
        </td>
      ))}
    </tr>
  );
}

// Pink: something is pending (also when late ones exist). Amber: all filed, some late.
function cellState(c: PmDmComplianceCell): "pending" | "late" | "ok" {
  if (c.expected === 0) return "ok";
  if (c.submitted < c.expected) return "pending";
  return c.on_time < c.submitted ? "late" : "ok";
}

function cellShade(c: PmDmComplianceCell): string {
  const state = cellState(c);
  return state === "pending" ? "bg-[#FFCCFF]" : state === "late" ? "bg-amber-200" : "";
}

function tone(value: number | null): string {
  if (value === null) return "text-slate-400";
  return value >= 90 ? "text-emerald-600" : value >= 70 ? "text-amber-600" : "text-red-600";
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("inline-block h-4 w-6 rounded border border-slate-300", className)} />
      {label}
    </span>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}
