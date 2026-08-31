"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { useDeApprovalQueue, type DeApprovalQueueRow } from "@/lib/api/de-approval";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/de-assessment-workspace/shared";

// DE Project Approval queue (design-reference/de-approval) — the DE-owned
// counterpart to the DE Assessment queue: same header / KPI grid / filter bar /
// table shape, driven by /de-approval/queue.

// "Awaiting Review" isn't a stored value — it's Pending Approval with no
// de_review_status yet; the backend still reports it as the row status label
// via project_status, so derive the badge text here.
function statusLabel(row: DeApprovalQueueRow): string {
  if (row.de_review_status) return row.de_review_status;
  if (row.project_status === "Pending Approval") return "Awaiting Review";
  return row.project_status;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  "Awaiting Review": "bg-amber-50 text-amber-700",
  "In Review": "bg-blue-50 text-[#1a6fc4]",
  Returned: "bg-red-50 text-red-700",
  Approved: "bg-emerald-50 text-emerald-700",
};

export function DeApprovalQueue() {
  const { data: periods = [] } = useReportingPeriods();
  const monthlyPeriods = periods
    .filter((p) => p.period_type === "Monthly")
    .sort((a, b) => b.start_date.localeCompare(a.start_date));

  const [periodOverride, setPeriodOverride] = React.useState<string | null>(null);
  const { data, isLoading, isError, error, refetch } = useDeApprovalQueue(periodOverride);
  const selectedPeriodId = periodOverride ?? data?.period_id ?? monthlyPeriods[0]?.id ?? "";

  const [search, setSearch] = React.useState("");
  const [geoFilter, setGeoFilter] = React.useState("All");

  const rows = React.useMemo(() => data?.rows ?? [], [data]);
  const geoNames = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.geo_name).filter((n): n is string => !!n))).sort(),
    [rows],
  );

  const filteredRows = rows.filter((row) => {
    if (search && !`${row.project_code} ${row.project_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (geoFilter !== "All" && row.geo_name !== geoFilter) return false;
    return true;
  });

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">DE Project Approval</h1>
          <p className="mt-1 text-sm text-slate-500">Review and approve project governance completeness</p>
        </div>
        {monthlyPeriods.length > 0 ? (
          <div className="w-56">
            <NativeSelect
              aria-label="Reporting Period"
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
          <p className="font-semibold">Couldn&apos;t load the approval queue.</p>
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Awaiting Review" value={data.kpis.awaiting_review} topAccent="emerald" />
            <StatCard label="In Review" value={data.kpis.in_review} topAccent="sky" />
            <StatCard
              label="Returned"
              value={data.kpis.returned}
              topAccent="red"
              accent={data.kpis.returned > 0 ? "red" : undefined}
            />
            <StatCard label="Approved" value={data.kpis.approved} topAccent="emerald-strong" />
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <Input
              aria-label="Search projects"
              placeholder="Search projects…"
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
                  ? "No projects awaiting your review."
                  : "No projects match the current filters."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                      <th className="px-5 py-3">Project</th>
                      <th className="px-3 py-3">Account</th>
                      <th className="px-3 py-3">PM</th>
                      <th className="px-3 py-3 w-48">Completeness</th>
                      <th className="px-3 py-3 text-right">Gaps</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Last Updated</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const label = statusLabel(row);
                      return (
                        <tr
                          key={row.project_id}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-2.5">
                            <div className="font-semibold text-slate-900">{row.project_name}</div>
                            <div className="font-mono text-xs text-slate-400">{row.project_code}</div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{row.account_name ?? "—"}</td>
                          <td className="px-3 py-2.5 text-slate-600">{row.project_manager_name ?? "—"}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={cn(
                                    "h-full",
                                    label === "Returned"
                                      ? "bg-red-500"
                                      : row.completion_pct >= 100
                                        ? "bg-emerald-500"
                                        : "bg-[#1a6fc4]",
                                  )}
                                  style={{ width: `${row.completion_pct}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs text-slate-500">{row.completion_pct}%</span>
                            </div>
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2.5 text-right font-mono",
                              row.gaps_count > 0 ? "text-red-600" : "text-slate-500",
                            )}
                          >
                            {row.gaps_count}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold",
                                STATUS_BADGE_CLASS[label] ?? "bg-slate-100 text-slate-600",
                              )}
                            >
                              {label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-500">
                            {row.last_updated.slice(0, 10)}
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <Link
                              href={`/de-approval/${row.project_id}`}
                              className="text-sm font-semibold text-[#1a6fc4] hover:underline"
                            >
                              Review
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
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
