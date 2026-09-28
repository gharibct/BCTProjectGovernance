"use client";

import { useNewProjectId } from "@/stores/new-project-ui";
import { useProject } from "@/lib/api/projects";
import { StatusBadge } from "@/components/forms/status-badge";
import { PageBanner } from "@/components/shell/page-banner";
import { QueryErrorState } from "@/components/shared/query-error-state";

// Matches the "{CODE} - Screen Name" heading convention used elsewhere
// (see project-reporting/reporting-hub.tsx). Every New Project screen is its
// own route, so `subheading` is always passed explicitly by the page.
export function NewProjectHeader({
  subheading,
}: {
  subheading?: string;
} = {}) {
  const projectId = useNewProjectId();
  const projectQuery = useProject(projectId);
  const { data: project } = projectQuery;

  // Shared across every New Project / Amend Project sub-page — see the same
  // note on ProjectHeader (project-header.tsx).
  if (projectQuery.isError) {
    return <QueryErrorState error={projectQuery.error} onRetry={() => projectQuery.refetch()} />;
  }

  const base = project?.project_code?.trim() || "New Project";
  const heading = subheading ? `${base} - ${subheading}` : base;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            {heading}
          </h1>
          {project?.project_name?.trim() ? (
            <p className="mt-3 flex items-center gap-2.5 text-slate-500">
              <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
              {project.project_name}
            </p>
          ) : null}
        </div>
        {/* Both states, side by side: where the project is in the approval
            workflow (Draft / Pending Approval / Approved / Under Amendment) and, once
            the first approval has set one, its lifecycle state (Ongoing / Hold /
            Closed / Open Only for Billing). Showing only the lifecycle value would
            hide "Under Amendment" / "Pending Approval" from an approved project. */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={project?.project_status ?? "Draft"} size="lg" />
          {project?.lifecycle_status ? <StatusBadge value={project.lifecycle_status} size="lg" /> : null}
        </div>
      </div>
      <PageBanner />
    </>
  );
}
