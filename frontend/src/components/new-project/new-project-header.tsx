"use client";

import { useNewProjectUi } from "@/stores/new-project-ui";
import { StatusBadge } from "@/components/forms/status-badge";

// Matches the "{CODE} - Screen Name" heading convention used elsewhere
// (see project-reporting/reporting-hub.tsx). Every New Project screen is its
// own route, so `subheading` is always passed explicitly by the page.
export function NewProjectHeader({
  subheading,
}: {
  subheading?: string;
} = {}) {
  const projectCode = useNewProjectUi((state) => state.projectCode);
  const projectName = useNewProjectUi((state) => state.projectName);
  const status = useNewProjectUi((state) => state.status);

  const base = projectCode.trim() || "New Project";
  const heading = subheading ? `${base} - ${subheading}` : base;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          {heading}
        </h1>
        {projectName.trim() ? (
          <p className="mt-3 flex items-center gap-2.5 text-slate-500">
            <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
            {projectName}
          </p>
        ) : null}
      </div>
      <StatusBadge value={status} size="lg" />
    </div>
  );
}
