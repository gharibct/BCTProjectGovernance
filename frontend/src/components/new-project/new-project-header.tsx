"use client";

import { useNewProjectUi, type NewProjectSection } from "@/stores/new-project-ui";

// Matches the "{CODE} - Screen Name" heading convention used elsewhere
// (see project-reporting/reporting-hub.tsx). Sections switched from the
// Project Charter tabs (Project Profile / Scope & Schedule / Self
// Assessment) derive their suffix from the shared section store; standalone
// routes (Measurement, DE Assessment, Project Status) pass `subheading`
// explicitly since they aren't part of that in-page tab switcher.
const SECTION_SUFFIX: Partial<Record<NewProjectSection, string>> = {
  description: "Project Profile",
  progress: "Scope & Schedule",
  health: "Self Assessment",
};

export function NewProjectHeader({
  subheading,
}: {
  subheading?: string;
} = {}) {
  const projectCode = useNewProjectUi((state) => state.projectCode);
  const projectName = useNewProjectUi((state) => state.projectName);
  const section = useNewProjectUi((state) => state.section);

  const base = projectCode.trim() || "New Project";
  const suffix = subheading ?? SECTION_SUFFIX[section];
  const heading = suffix ? `${base} - ${suffix}` : base;

  return (
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
  );
}
