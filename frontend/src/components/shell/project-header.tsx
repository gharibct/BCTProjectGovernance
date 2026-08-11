"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";

import { ReportingBreadcrumb } from "@/components/shell/reporting-breadcrumb";
import { ReportingPeriodBadge } from "@/components/shell/reporting-period-badge";
import { PageBanner } from "@/components/shell/page-banner";
import { StatusBadge } from "@/components/forms/status-badge";
import { useProject } from "@/lib/api/projects";

export function ProjectHeader({ hidePeriod }: { hidePeriod?: boolean } = {}) {
  const { projectId } = useParams<{ projectId?: string }>();
  const { data: project } = useProject(projectId ?? null);

  const heading = project?.project_code?.trim() || "Project Reporting";

  return (
    <>
      <div>
        {/* useSearchParams (for the period) requires a Suspense boundary */}
        <Suspense fallback={null}>
          <ReportingBreadcrumb hidePeriod={hidePeriod} />
        </Suspense>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              {heading}
            </h1>
            {hidePeriod ? null : (
              // useSearchParams requires a Suspense boundary at prerender
              <Suspense fallback={null}>
                <ReportingPeriodBadge />
              </Suspense>
            )}
          </div>
          {project?.project_status ? (
            <StatusBadge value={project.project_status} size="lg" />
          ) : null}
        </div>
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
