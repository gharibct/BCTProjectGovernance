"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { ReportingBreadcrumb } from "@/components/shell/reporting-breadcrumb";
import { ReportingPeriodPill } from "@/components/shell/reporting-period-badge";
import { PageBanner } from "@/components/shell/page-banner";
import { StatusBadge } from "@/components/forms/status-badge";
import { useProject } from "@/lib/api/projects";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { useStatusReports } from "@/lib/api/project-status";

type ProjectHeaderProps = {
  subheading?: string;
  // Explicit "which period" override for callers (Project Dashboard) that
  // already resolved one via their own fallback chain — omit to read the raw
  // ?period= off the URL directly (Project Status's behavior: no fallback).
  periodId?: string | null;
  // Project Status only: ignore `subheading`, use "{period.period_type} Report" instead.
  dynamicSubheading?: boolean;
};

// Every Project Reporting screen shows the same "<Screen Name> Period:
// <bubble> Report Status: <badge>" line, then the project name below —
// reads ?period= (or the passed-in override) and the report for that period.
// Split out because useSearchParams needs its own Suspense boundary, same
// pattern PeriodAwareHeading/PeriodAwareBody use elsewhere in this app.
function HeadingRow({
  projectId,
  base,
  subheading,
  periodId: periodIdProp,
  dynamicSubheading,
}: ProjectHeaderProps & { projectId: string | null; base: string }) {
  const searchParams = useSearchParams();
  const periodId = periodIdProp !== undefined ? periodIdProp : searchParams.get("period");

  const { data: periods = [] } = useReportingPeriods();
  const { data: reports = [] } = useStatusReports(projectId);

  const period = periods.find((p) => p.id === periodId);
  const report = reports.find((r) => r.period_id === periodId);

  const suffix = dynamicSubheading ? (period ? `${period.period_type} Report` : undefined) : subheading;
  const heading = suffix ? `${base} - ${suffix}` : base;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">{heading}</h1>
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-slate-500">Period:</span>
          {period ? <ReportingPeriodPill label={period.label} /> : <span className="text-slate-300">—</span>}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-slate-500">Report Status:</span>
          <StatusBadge value={report?.status ?? ""} size="lg" />
        </span>
      </div>
    </div>
  );
}

// Matches the "{CODE} - Screen Name" heading convention used elsewhere (see
// new-project-header.tsx / reporting-hub.tsx) — every Project Reporting
// screen is its own route, so `subheading` is passed explicitly by the page.
export function ProjectHeader({ subheading, periodId, dynamicSubheading }: ProjectHeaderProps = {}) {
  const { projectId } = useParams<{ projectId?: string }>();
  const { data: project } = useProject(projectId ?? null);

  const base = project?.project_code?.trim() || "Project Reporting";

  return (
    <>
      <div>
        {/* useSearchParams (for the period) requires a Suspense boundary */}
        <Suspense fallback={null}>
          <ReportingBreadcrumb />
        </Suspense>
        <Suspense fallback={null}>
          <HeadingRow
            projectId={projectId ?? null}
            base={base}
            subheading={subheading}
            periodId={periodId}
            dynamicSubheading={dynamicSubheading}
          />
        </Suspense>
        {project?.project_name?.trim() ? (
          <p className="mt-3 flex items-center gap-2.5 text-slate-500">
            <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
            {project.project_name}
          </p>
        ) : null}
      </div>
      <PageBanner />
    </>
  );
}
