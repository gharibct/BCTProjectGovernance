"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageBanner } from "@/components/shell/page-banner";
import { StatusBadge } from "@/components/forms/status-badge";
import { useAccounts, useGeos, useReportingPeriods } from "@/lib/api/reference-data";
import {
  useRegionalReportingActivity,
  useRegionalStatusReports,
  type RegionalScope,
} from "@/lib/api/regional-status";
import { comboPeriods, currentActivityPeriodId, EMPTY_ACTIVITY_SERIES } from "@/lib/reporting-activity";
import { ReportingProgressCard, WEEKLY_ACCENT } from "@/components/reporting/progress-ring-card";
import { ReportingActivityGrid } from "@/components/reporting/activity-grid";

const SCOPE_CONFIG: Record<
  RegionalScope,
  { paramKey: string; reportTitle: string; typePill: string; fallbackName: string }
> = {
  account: {
    paramKey: "accountId",
    reportTitle: "Account Status Reporting",
    typePill: "Account Status",
    fallbackName: "Account Reporting",
  },
  geo: {
    paramKey: "geoId",
    reportTitle: "Geo Status Reporting",
    typePill: "Geo Status",
    fallbackName: "Geo Reporting",
  },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

// Account / Geo Status Reporting hub — a single Weekly cadence (no Monthly),
// mirroring the Project Reporting redesign but with the progress ring and the
// weekly activity heatmap side by side on the first row. Server-computed via
// GET /{scope}s/{id}/reporting-activity.
export function RegionalReportingHub({ scope }: { scope: RegionalScope }) {
  const config = SCOPE_CONFIG[scope];
  const params = useParams<Record<string, string>>();
  const scopeId = params[config.paramKey] ?? "";

  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();
  const { data: periods = [] } = useReportingPeriods();
  const { data: reports = [] } = useRegionalStatusReports(scope, scopeId || null);
  const { data: activity } = useRegionalReportingActivity(scope, scopeId || null);

  const name =
    (scope === "account"
      ? accounts.find((a) => a.id === scopeId)?.name
      : geos.find((g) => g.id === scopeId)?.name) ?? config.fallbackName;

  const entryHref = `/${scope}-reporting/${scopeId}/dashboard`;
  const weekly = activity?.weekly ?? EMPTY_ACTIVITY_SERIES;

  const currentWeekId = currentActivityPeriodId(weekly.items);
  const [weekOverride, setWeekOverride] = useState<string>();
  const weekId = weekOverride ?? currentWeekId ?? "";
  const weekOptions = useMemo(() => comboPeriods(weekly.items), [weekly]);

  const periodHref = (id: string) => (id ? `${entryHref}?period=${id}` : entryHref);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">{name} - Reporting Summary</h1>
        <p className="mt-2 max-w-3xl text-slate-500">{config.reportTitle}</p>
      </div>

      <PageBanner />

      <div className="grid gap-6 xl:grid-cols-2">
        <ReportingProgressCard
          title={config.reportTitle}
          icon={CalendarDays}
          captionNoun="Weekly Reports"
          series={weekly}
          accent={WEEKLY_ACCENT}
          comboLabel="Week Selection"
          options={weekOptions}
          value={weekId}
          currentId={currentWeekId}
          onChange={setWeekOverride}
          actionHref={periodHref(weekId)}
          actionLabel={`Open ${config.reportTitle}`}
        />
        <ReportingActivityGrid
          title="Weekly Reporting Activity"
          items={weekly.items}
          variant="weekly"
        />
      </div>

      <section>
        <h2 className="text-lg font-bold text-slate-900">Reporting History</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr className="text-xs tracking-wide text-slate-500 uppercase">
                <th className="px-6 py-3 font-bold">Reporting Period</th>
                <th className="px-3 py-3 font-bold">Type</th>
                <th className="px-3 py-3 font-bold">Created On</th>
                <th className="px-3 py-3 font-bold">Status</th>
                <th className="px-3 py-3 font-bold">Last Updated</th>
                <th className="px-6 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-slate-400">
                    No reports submitted yet.
                  </td>
                </tr>
              ) : (
                reports.map((report) => {
                  const period = periods.find((p) => p.id === report.period_id);
                  const typeLabel =
                    period?.period_type === "Weekly"
                      ? config.typePill
                      : (period?.period_type ?? "—");
                  return (
                    <tr
                      key={report.id}
                      className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-6 py-3.5 font-bold text-slate-900">
                        {period?.label ?? "—"}
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className={cn(
                            "rounded px-2.5 py-1 text-xs font-semibold",
                            period?.period_type === "Weekly"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-blue-50 text-[#1a6fc4]"
                          )}
                        >
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-slate-700">{formatDate(report.created_at)}</td>
                      <td className="px-3 py-3.5">
                        <StatusBadge value={report.status} />
                      </td>
                      <td className="px-3 py-3.5 text-slate-700">{formatDate(report.updated_at)}</td>
                      <td className="px-6 py-3.5 text-right">
                        <Button
                          asChild
                          variant="outline"
                          className="h-8 w-20 text-xs font-semibold"
                        >
                          <Link href={`${entryHref}?period=${report.period_id}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
