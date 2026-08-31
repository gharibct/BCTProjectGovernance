"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { useDeDashboardSummary, type DEAssessmentWorkQueueRow } from "@/lib/api/de-dashboard";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { HealthDot, StatCard } from "./shared";

// DE Assessment queue (design-reference/de-assessments/01_de_assessment_project_queue).
// The DE-owned counterpart to the compact widget on My Summary — same
// /dashboard/de-summary data, fuller KPIs, and client-side filters.

const STATUS_BADGE_CLASS: Record<DEAssessmentWorkQueueRow["status"], string> = {
  "Not Started": "bg-slate-100 text-slate-600",
  Draft: "bg-amber-50 text-amber-700",
  Submitted: "bg-emerald-50 text-emerald-700",
};

export function DeAssessmentQueue() {
  const { data: periods = [] } = useReportingPeriods();
  const monthlyPeriods = periods
    .filter((p) => p.period_type === "Monthly")
    .sort((a, b) => b.start_date.localeCompare(a.start_date));

  const [periodOverride, setPeriodOverride] = React.useState<string | null>(null);
  const { data, isLoading, isError, error, refetch } = useDeDashboardSummary(periodOverride);
  const selectedPeriodId = periodOverride ?? data?.period_id ?? "";

  const [search, setSearch] = React.useState("");
  const [geoFilter, setGeoFilter] = React.useState("All");

  const rows = React.useMemo(() => data?.work_queue ?? [], [data]);
  const geoNames = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.geo_name).filter((n): n is string => !!n))).sort(),
    [rows]
  );

  const filteredRows = rows.filter((row) => {
    if (search && !row.project_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (geoFilter !== "All" && row.geo_name !== geoFilter) return false;
    return true;
  });

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">DE Assessment</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monthly Delivery Excellence assessment of projects
          </p>
        </div>
        {monthlyPeriods.length > 0 ? (
          <div className="w-56">
            <NativeSelect
              aria-label="Assessment Period"
              className="h-10 bg-white text-sm"
              value={selectedPeriodId}
              onChange={(e) => setPeriodOverride(e.target.value)}
            >
              {monthlyPeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </header>

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold">Couldn&apos;t load the assessment queue.</p>
          <p className="mt-1 text-red-600">
            {error instanceof ApiError ? String(error.detail ?? error.message) : "Something went wrong."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : isLoading || !data ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
            <StatCard label="Total Due" value={data.completion.total_count} />
            <StatCard label="Completed" value={data.completion.completed_count} />
            <StatCard label="Pending" value={data.pending_count} />
            <StatCard label="Red / Amber Assessed" value={data.red_amber_assessed_count} accent="red" />
            <StatCard
              label="Average PCI"
              value={data.average_pci != null ? `${data.average_pci}%` : "—"}
            />
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <Input
              aria-label="Search Project"
              placeholder="Search Project…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 min-w-[240px] flex-1"
            />
            <div className="w-40 shrink-0">
              <NativeSelect
                aria-label="Geo filter"
                className="h-9 text-sm"
                value={geoFilter}
                onChange={(e) => setGeoFilter(e.target.value)}
              >
                <option value="All">Geo [All]</option>
                {geoNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {filteredRows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">
                {rows.length === 0
                  ? "No projects in scope for this period."
                  : "No projects match the current filters."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                      <th className="px-5 py-3">Project</th>
                      <th className="px-3 py-3">Account</th>
                      <th className="px-3 py-3">Project Manager</th>
                      <th className="px-3 py-3 text-center">PM Health</th>
                      <th className="px-3 py-3 text-center">Prev DE Health</th>
                      <th className="px-3 py-3 text-right">Prev PCI</th>
                      <th className="px-3 py-3 text-center">Open Findings</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr
                        key={row.project_id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-2.5 font-semibold text-slate-900">{row.project_name}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.account_name ?? "—"}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.project_manager_name ?? "—"}</td>
                        <td className="px-3 py-2.5 text-center">
                          <HealthDot health={row.pm_health} />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <HealthDot health={row.prev_de_health} />
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                          {row.prev_pci_score ? `${row.prev_pci_score}%` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {row.open_findings_count > 0 ? (
                            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                              {row.open_findings_count}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold",
                              STATUS_BADGE_CLASS[row.status]
                            )}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <QueueAction row={row} periodId={selectedPeriodId} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function QueueAction({ row, periodId }: { row: DEAssessmentWorkQueueRow; periodId: string }) {
  const href = `/de-assessment/${row.project_id}${periodId ? `?period=${periodId}` : ""}`;
  const label = row.status === "Not Started" ? "Assess" : row.status === "Draft" ? "Continue" : "View";
  const primary = row.status !== "Submitted";
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-semibold",
        primary
          ? "bg-[#1a6fc4] text-white hover:bg-[#1a6fc4]/90"
          : "border border-slate-300 text-slate-700 hover:bg-slate-50"
      )}
    >
      {label}
    </Link>
  );
}
