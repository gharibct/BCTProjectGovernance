"use client";

import { useNewProjectId } from "@/stores/new-project-ui";
import { useProject } from "@/lib/api/projects";
import { StatusBadge } from "@/components/forms/status-badge";
import { PageBanner } from "@/components/shell/page-banner";

// Matches the "{CODE} - Screen Name" heading convention used elsewhere
// (see project-reporting/reporting-hub.tsx). Every New Project screen is its
// own route, so `subheading` is always passed explicitly by the page.
export function NewProjectHeader({
  subheading,
}: {
  subheading?: string;
} = {}) {
  const projectId = useNewProjectId();
  const { data: project } = useProject(projectId);

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
        <StatusBadge value={project?.project_status ?? "Draft"} size="lg" />
      </div>
      <PageBanner />
    </>
  );
}
