"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, ChartColumn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageBanner } from "@/components/shell/page-banner";
import { StatusBadge } from "@/components/forms/status-badge";
import { useProject } from "@/lib/api/projects";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { useReportingActivity, useStatusReports } from "@/lib/api/project-status";
import {
  comboPeriods,
  currentActivityPeriodId,
  EMPTY_ACTIVITY_SERIES,
} from "@/lib/reporting-activity";
import {
  MONTHLY_ACCENT,
  ReportingProgressCard,
  WEEKLY_ACCENT,
} from "@/components/reporting/progress-ring-card";
import { ReportingActivityGrid } from "@/components/reporting/activity-grid";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

export function ReportingHub() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project } = useProject(projectId ?? null);
  const { data: periods = [] } = useReportingPeriods();
  const { data: reports = [] } = useStatusReports(projectId ?? null);
  const { data: activity } = useReportingActivity(projectId ?? null);

  // Project Dashboard (the consolidated preview + submit screen) is where
  // entering the reporting flow for a period should land.
  const dashboardHref = `/project-reporting/${projectId}/dashboard`;

  const weekly = activity?.weekly ?? EMPTY_ACTIVITY_SERIES;
  const monthly = activity?.monthly ?? EMPTY_ACTIVITY_SERIES;

  const currentWeekId = currentActivityPeriodId(weekly.items);
  const currentMonthId = currentActivityPeriodId(monthly.items);

  // undefined until the user picks explicitly, so each combo defaults to the
  // current period once the activity loads without a sync effect.
  const [weekOverride, setWeekOverride] = useState<string>();
  const [monthOverride, setMonthOverride] = useState<string>();
  const weekId = weekOverride ?? currentWeekId ?? "";
  const monthId = monthOverride ?? currentMonthId ?? "";

  // Combo options: in-window periods only (after project start, up to today
  // or the project end), newest first, at most 15 back from the current one.
  const weekOptions = useMemo(() => comboPeriods(weekly.items), [weekly]);
  const monthOptions = useMemo(() => comboPeriods(monthly.items), [monthly]);

  const periodHref = (periodId: string) =>
    periodId ? `${dashboardHref}?period=${periodId}` : dashboardHref;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          {project?.project_code ? `${project.project_code} - Reporting Summary` : "Report Project"}
        </h1>
        <p className="mt-2 max-w-3xl text-slate-500">
          {project?.project_scope_description || project?.customer_overview || project?.project_name}
        </p>
      </div>

      <PageBanner />

      <div className="grid gap-6 xl:grid-cols-2">
        <ReportingProgressCard
          title="Delivery Status Reporting (Weekly)"
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
          actionLabel="Open Delivery Status Reporting"
        />
        <ReportingProgressCard
          title="Metrics Reporting (Monthly)"
          icon={ChartColumn}
          captionNoun="Monthly Metrics"
          series={monthly}
          accent={MONTHLY_ACCENT}
          comboLabel="Month Selection"
          options={monthOptions}
          value={monthId}
          currentId={currentMonthId}
          onChange={setMonthOverride}
          actionHref={periodHref(monthId)}
          actionLabel="Open Metric Reporting"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ReportingActivityGrid
          title="Weekly Reporting Activity"
          items={weekly.items}
          variant="weekly"
        />
        <ReportingActivityGrid
          title="Monthly Reporting Activity"
          items={monthly.items}
          variant="monthly"
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
                      ? "Weekly Delivery Status"
                      : period?.period_type === "Monthly"
                        ? "Monthly Metrics"
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
                          <Link href={`${dashboardHref}?period=${report.period_id}`}>Open</Link>
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
