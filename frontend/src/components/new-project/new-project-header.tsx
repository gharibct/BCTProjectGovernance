"use client";

import { useNewProjectId } from "@/stores/new-project-ui";
import { useProject } from "@/lib/api/projects";
import { StatusBadge } from "@/components/forms/status-badge";

// The backend's ProjectStatus has no separate "Draft" state — a project is
// "Start Up" the instant POST /projects creates it (see lib/api/projects.ts)
// — but from the charter's point of view a freshly created, not-yet-
// Approved project reads better as "Draft". This only relabels the badge;
// the underlying project_status value (and the Approve button's logic,
// which checks the real "Start Up" value) is unchanged.
function displayStatus(status: string | undefined): string {
  return status === "Start Up" ? "Draft" : (status ?? "Draft");
}

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
      <StatusBadge value={displayStatus(project?.project_status)} size="lg" />
    </div>
  );
}
