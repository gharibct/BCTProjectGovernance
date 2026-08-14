"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRightToLine, CircleCheck, Flag, HeartPulse, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageBanner } from "@/components/shell/page-banner";
import { StatusBadge } from "@/components/forms/status-badge";
import { useProject, type HealthRating as ApiHealthRating } from "@/lib/api/projects";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { useStatusReports } from "@/lib/api/project-status";
import { HealthPill, RATING_FROM_API } from "@/components/project-charter/health-declaration";
import { StarterCards } from "./starter-cards";

// No Milestones backend yet — this tile stays sample data until one exists.
const MILESTONES_STAT = {
  label: "Milestones",
  value: "12/15",
  qualifier: "On Track",
  qualifierClass: "text-[#1a6fc4]",
  icon: Flag,
};

// Mirrors health-declaration.tsx's own three fields: Delivery Declared
// Overall, DE Assessed Project Health, and the highest-severity Overall
// Health rollup between them — all real backend columns on Project.
const HEALTH_STATS: {
  label: string;
  field: "delivery_declared_overall_health" | "de_assessed_project_health" | "overall_project_health";
  icon: typeof HeartPulse;
}[] = [
  { label: "Delivery Declared Health", field: "delivery_declared_overall_health", icon: HeartPulse },
  { label: "DE Assessed Health", field: "de_assessed_project_health", icon: ShieldCheck },
  { label: "Overall Health", field: "overall_project_health", icon: CircleCheck },
];

function ratingFrom(value: ApiHealthRating | null) {
  return value ? RATING_FROM_API[value] : null;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

export function ReportingHub() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project } = useProject(projectId ?? null);
  const { data: periods = [] } = useReportingPeriods();
  const { data: reports = [] } = useStatusReports(projectId ?? null);
  // Project Dashboard (the consolidated report preview + submit screen) is
  // where entering the reporting flow for a period should land — Project
  // Status/RAG Status stay reachable from its nav for actually editing.
  const dashboardHref = `/project-reporting/${projectId}/dashboard`;

  // The list endpoint already orders by the period's start_date desc, so
  // the first row is the latest report across both Weekly and Monthly.
  const latestReport = reports[0];
  const latestReportHref = latestReport ? `${dashboardHref}?period=${latestReport.period_id}` : dashboardHref;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            {project?.project_code ? `${project.project_code} - Reporting Summary` : "Project Reporting"}
          </h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            {project?.project_scope_description || project?.customer_overview || project?.project_name}
          </p>
        </div>
        <Button
          asChild
          className="h-11 shrink-0 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
        >
          <Link href={latestReportHref}>
            <ArrowRightToLine className="size-4" />
            Goto Latest Report
          </Link>
        </Button>
      </div>

      <PageBanner />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              {MILESTONES_STAT.label}
            </span>
            <MILESTONES_STAT.icon className="size-4.5 text-[#1a6fc4]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{MILESTONES_STAT.value}</span>
            <span
              className={cn(
                "text-xs font-bold tracking-wide uppercase",
                MILESTONES_STAT.qualifierClass
              )}
            >
              {MILESTONES_STAT.qualifier}
            </span>
          </div>
        </div>

        {HEALTH_STATS.map((stat) => {
          const rating = ratingFrom(project?.[stat.field] ?? null);
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                  {stat.label}
                </span>
                <stat.icon className="size-4.5 text-[#1a6fc4]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                {rating ? (
                  <HealthPill rating={rating} />
                ) : (
                  <span className="text-sm font-semibold text-slate-400">Not assessed</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <StarterCards />

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
                          {period?.period_type ?? "—"}
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
