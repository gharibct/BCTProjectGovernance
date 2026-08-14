"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";

import { useProject } from "@/lib/api/projects";
import { useProjectTypes } from "@/lib/api/reference-data";

import { CloudMaintenanceTab } from "./cloud-maintenance-form";
import { CloudMigrationTab } from "./cloud-migration-form";
import { DevelopmentTab } from "./development-form";
import { StaffingTab } from "./staffing-form";
import { SupportTab } from "./support-form";
import { TestingTab } from "./testing-form";

// One measurement form per Project Type (see db/seed_dev.sql project_types)
// — a project only ever shows the single tab matching its own type, not a
// switcher across all of them, mirroring New Project's target-setting tabs.
const TABS = [
  { code: "DEVELOPMENT", label: "Development", content: DevelopmentTab },
  { code: "SUPPORT", label: "Support", content: SupportTab },
  { code: "PROFESSIONAL_STAFFING", label: "Professional Staffing", content: StaffingTab },
  { code: "TESTING", label: "Testing", content: TestingTab },
  { code: "CLOUD_MAINTENANCE", label: "Cloud Maintenance", content: CloudMaintenanceTab },
  { code: "CLOUD_MIGRATION", label: "Cloud Migration", content: CloudMigrationTab },
] as const;

export function MeasurementTabs() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;
  const { data: project } = useProject(projectId);
  const { data: projectTypes } = useProjectTypes();
  const projectTypeCode = projectTypes?.find((t) => t.id === project?.project_type_id)?.code;
  const activeTab = TABS.find((t) => t.code === projectTypeCode);

  if (!projectId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No project selected.
      </p>
    );
  }

  if (!activeTab) {
    return (
      <p className="text-sm text-slate-500">
        Set a Project Type on the Project Profile screen to see its measurement fields.
      </p>
    );
  }

  const Active = activeTab.content;

  return (
    // A project only ever matches one Project Type, so there's never
    // anything to switch between — no tab chrome, just the one form.
    // useSearchParams (for the period) requires a Suspense boundary.
    <Suspense fallback={null}>
      <Active projectId={projectId} />
    </Suspense>
  );
}
