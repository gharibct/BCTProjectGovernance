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

// Reads the ?period= reporting_periods.id that status-form.tsx also reads —
// the URL is the single source of truth for "which report is being viewed",
// so this header and the form stay in sync with no prop-drilling/store.
function PeriodAwareHeading({ projectId }: { projectId: string | null }) {
  const searchParams = useSearchParams();
  const periodId = searchParams.get("period");

  const { data: project } = useProject(projectId);
  const { data: periods } = useReportingPeriods();
  const { data: reports } = useStatusReports(projectId);

  const period = periods?.find((p) => p.id === periodId);
  const report = reports?.find((r) => r.period_id === periodId);
  const heading = project?.project_code?.trim() || "Project Reporting";

  return (
    <>
      <ReportingBreadcrumb periodLabel={period?.label} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            {period ? `${heading} - ${period.period_type} Report` : heading}
          </h1>
          {period ? <ReportingPeriodPill label={period.label} /> : null}
          {report ? <StatusBadge value={report.status} size="lg" /> : null}
        </div>
        {project?.project_status ? <StatusBadge value={project.project_status} size="lg" /> : null}
      </div>
    </>
  );
}

export function StatusHeader() {
  const { projectId } = useParams<{ projectId?: string }>();
  const { data: project } = useProject(projectId ?? null);

  return (
    <>
      <div>
        {/* useSearchParams (for the selected reporting period) requires a
            Suspense boundary at prerender. */}
        <Suspense fallback={null}>
          <PeriodAwareHeading projectId={projectId ?? null} />
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
