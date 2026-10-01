"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, ChartColumn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageBanner } from "@/components/shell/page-banner";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { StatusBadge } from "@/components/forms/status-badge";
import { useProject } from "@/lib/api/projects";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { submissionStatusLabel, useReportingActivity, useStatusReports } from "@/lib/api/project-status";
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

// One hub per report type: Report Delivery Status (Weekly) and Report Project
// Performance (Monthly) each get their own landing page.
export function ReportingHub({ kind }: { kind: "delivery" | "performance" }) {
  const isDelivery = kind === "delivery";
  const { projectId } = useParams<{ projectId: string }>();
  const projectQuery = useProject(projectId ?? null);
  const { data: project } = projectQuery;
  const { data: periods = [] } = useReportingPeriods();
  const { data: reports = [] } = useStatusReports(projectId ?? null);
  const { data: activity } = useReportingActivity(projectId ?? null);

  // Report Delivery Status opens the merged Delivery Status Report (Project
  // Status + RAG Status, submitted from Project Delivery Status); Report
  // Project Performance lands on the monthly Project Performance dashboard.
  const dashboardHref = isDelivery
    ? `/project-reporting/${projectId}/project-status`
    : `/project-reporting/${projectId}/dashboard`;

  const series = (isDelivery ? activity?.weekly : activity?.monthly) ?? EMPTY_ACTIVITY_SERIES;
  const currentId = currentActivityPeriodId(series.items);

  // undefined until the user picks explicitly, so the combo defaults to the
  // current period once the activity loads without a sync effect.
  const [override, setOverride] = useState<string>();
  const selectedId = override ?? currentId ?? "";

  // Combo options: in-window periods only (after project start, up to today
  // or the project end), newest first, at most 15 back from the current one.
  const options = useMemo(() => comboPeriods(series.items), [series]);

  const periodHref = (periodId: string) =>
    periodId ? `${dashboardHref}?period=${periodId}` : dashboardHref;

  const periodType = isDelivery ? "Weekly" : "Monthly";
  const typeReports = reports.filter(
    (r) => periods.find((p) => p.id === r.period_id)?.period_type === periodType,
  );

  // All hooks above must run unconditionally every render — this early
  // return has to come after every one of them, not interspersed.
  if (projectQuery.isError) {
    return <QueryErrorState error={projectQuery.error} onRetry={() => projectQuery.refetch()} />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          {project?.project_code
            ? `${project.project_code} - ${isDelivery ? "Report Delivery Status" : "Report Project Performance"}`
            : isDelivery
              ? "Report Delivery Status"
              : "Report Project Performance"}
        </h1>
        <p className="mt-2 max-w-3xl text-slate-500">
          {project?.project_scope_description || project?.customer_overview || project?.project_name}
        </p>
      </div>

      <PageBanner />

      <div className="grid gap-6 xl:grid-cols-2">
        <ReportingProgressCard
          title={isDelivery ? "Delivery Status Reporting (Weekly)" : "Project Performance Report (Monthly)"}
          icon={isDelivery ? CalendarDays : ChartColumn}
          captionNoun={isDelivery ? "Weekly Reports" : "Monthly Metrics"}
          series={series}
          accent={isDelivery ? WEEKLY_ACCENT : MONTHLY_ACCENT}
          comboLabel={isDelivery ? "Week Selection" : "Month Selection"}
          options={options}
          value={selectedId}
          currentId={currentId}
          onChange={setOverride}
          actionHref={periodHref(selectedId)}
          actionLabel={isDelivery ? "Delivery Status Reporting" : "Project Performance Reporting"}
        />
        <ReportingActivityGrid items={series.items} variant={isDelivery ? "weekly" : "monthly"} />
      </div>

      <section>
        <h2 className="text-lg font-bold text-slate-900">
          {isDelivery ? "Delivery Status History" : "Project Performance History"}
        </h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#D6E9F8]">
              <tr className="text-xs tracking-wide text-[#205889] uppercase">
                <th className="px-6 py-3 font-bold">Reporting Period</th>
                <th className="px-3 py-3 font-bold">Type</th>
                <th className="px-3 py-3 font-bold">Created On</th>
                <th className="px-3 py-3 font-bold">Status</th>
                <th className="px-3 py-3 font-bold">Last Updated</th>
                <th className="px-6 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {typeReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-slate-400">
                    No reports submitted yet.
                  </td>
                </tr>
              ) : (
                typeReports.map((report) => {
                  const period = periods.find((p) => p.id === report.period_id);
                  const typeLabel =
                    period?.period_type === "Weekly"
                      ? "Delivery Status"
                      : period?.period_type === "Monthly"
                        ? "Project Performance"
                        : (period?.period_type ?? "—");
                  return (
                    <tr
                      key={report.id}
                      className="border-t border-[#E4E9EE] bg-white transition-colors even:bg-[#F8FAFB] hover:bg-[#EDF3F7]"
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
                        <StatusBadge value={submissionStatusLabel(report.status)} />
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
