"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/forms/empty-state";
import { ReviewedNoChangesButton } from "@/components/reporting/reviewed-no-changes-button";
import { useProject } from "@/lib/api/projects";
import { useProjectTypes } from "@/lib/api/reference-data";

import { CloudMaintenanceTab } from "./cloud-maintenance-form";
import { CloudMigrationTab } from "./cloud-migration-form";
import { ConsultingTab } from "./consulting-form";
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
  { code: "CONSULTING", label: "Consulting", content: ConsultingTab },
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
      <EmptyState>No project selected.</EmptyState>
    );
  }

  if (!activeTab) {
    return (
      <p className="text-sm text-slate-500">
        Set a Project Type on the Project Profile screen to see its measurement fields.
      </p>
    );
  }

  return (
    // A project only ever matches one Project Type, so there's never
    // anything to switch between — no tab chrome, just the one form.
    // useSearchParams (for the period) requires a Suspense boundary.
    <Suspense fallback={null}>
      <MeasurementTabBody projectId={projectId} Content={activeTab.content} />
    </Suspense>
  );
}

function MeasurementTabBody({
  projectId,
  Content,
}: {
  projectId: string;
  Content: (typeof TABS)[number]["content"];
}) {
  const periodId = useSearchParams().get("period");

  return (
    <div className="flex flex-col gap-6">
      <Content projectId={projectId} />
      <div className="flex justify-end">
        <ReviewedNoChangesButton projectId={projectId} periodId={periodId} pageType="MEASUREMENT" />
      </div>
    </div>
  );
}
