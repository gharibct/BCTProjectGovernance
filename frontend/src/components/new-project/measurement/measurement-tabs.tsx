"use client";

import * as React from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNewProjectId } from "@/stores/new-project-ui";
import { usePageBanner } from "@/stores/page-banner";
import { useProject } from "@/lib/api/projects";
import { useProjectTypes } from "@/lib/api/reference-data";
import {
  useCloudMaintenanceTarget,
  useCloudMigrationTarget,
  useConsultingTarget,
  useDevelopmentTarget,
  useSaveCloudMaintenanceTarget,
  useSaveCloudMigrationTarget,
  useSaveConsultingTarget,
  useSaveDevelopmentTarget,
  useSaveStaffingTarget,
  useSaveSupportTarget,
  useSaveTestingTarget,
  useStaffingTarget,
  useSupportTarget,
  useTestingTarget,
} from "@/lib/api/metric-targets";

import { CloudMaintenanceTab, fromCloudMaintenanceTarget, toCloudMaintenancePayload } from "./cloud-maintenance-form";
import { CloudMigrationTab, fromCloudMigrationTarget, toCloudMigrationPayload } from "./cloud-migration-form";
import { ConsultingTab, fromConsultingTarget, toConsultingPayload } from "./consulting-form";
import { DevelopmentTab, fromDevelopmentTarget, toDevelopmentPayload } from "./development-form";
import { useMeasures } from "./shared";
import { StaffingTab, fromStaffingTarget, toStaffingPayload } from "./staffing-form";
import { SupportTab, fromSupportTarget, toSupportPayload } from "./support-form";
import { TestingTab, fromTestingTarget, toTestingPayload } from "./testing-form";

// One measurement form per Project Type (see db/seed_dev.sql project_types)
// — a project only ever shows the single tab matching its own type, not a
// switcher across all of them.
const TABS = [
  { code: "DEVELOPMENT", label: "Development", content: DevelopmentTab },
  { code: "SUPPORT", label: "Support", content: SupportTab },
  { code: "PROFESSIONAL_STAFFING", label: "Professional Staffing", content: StaffingTab },
  { code: "TESTING", label: "Testing", content: TestingTab },
  { code: "CLOUD_MAINTENANCE", label: "Cloud Maintenance", content: CloudMaintenanceTab },
  { code: "CLOUD_MIGRATION", label: "Cloud Migration", content: CloudMigrationTab },
  { code: "CONSULTING", label: "Consulting", content: ConsultingTab },
] as const;

// Each Project Type's target row has its own shape (see
// backend/app/schemas/metric_target.py), so rather than force them into one
// generic interface, this switch just wraps each type's query/mutation pair
// behind the one shape MeasurementTabs actually needs: a seed to populate the
// form with and a submit callback to save it. All hooks are still called
// unconditionally above (each gated by its own `enabled` flag) to satisfy the
// rules of hooks.
// Every other Save/Add flow in this app (risk-log.tsx, charter-form.tsx,
// etc.) toasts on success/error — this was the one place that called
// .mutate() with no callbacks at all, so saving here gave no feedback.
function saveWithBanner<TData, TPayload>(
  mutation: UseMutationResult<TData, Error, TPayload>,
  payload: TPayload,
  showSuccess: (message: string) => void,
  showError: (message: string) => void
) {
  mutation.mutate(payload, {
    onSuccess: () => showSuccess("Measurement Targets Saved Successfully"),
    onError: (err) => showError(err instanceof Error ? err.message : "Failed to save measurement targets."),
  });
}

function useActiveTarget(projectId: string | null, projectTypeCode: string | undefined) {
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);
  const development = useDevelopmentTarget(projectId, projectTypeCode === "DEVELOPMENT");
  const support = useSupportTarget(projectId, projectTypeCode === "SUPPORT");
  const staffing = useStaffingTarget(projectId, projectTypeCode === "PROFESSIONAL_STAFFING");
  const testing = useTestingTarget(projectId, projectTypeCode === "TESTING");
  const cloudMaintenance = useCloudMaintenanceTarget(projectId, projectTypeCode === "CLOUD_MAINTENANCE");
  const cloudMigration = useCloudMigrationTarget(projectId, projectTypeCode === "CLOUD_MIGRATION");
  const consulting = useConsultingTarget(projectId, projectTypeCode === "CONSULTING");

  const saveDevelopment = useSaveDevelopmentTarget(projectId);
  const saveSupport = useSaveSupportTarget(projectId);
  const saveStaffing = useSaveStaffingTarget(projectId);
  const saveTesting = useSaveTestingTarget(projectId);
  const saveCloudMaintenance = useSaveCloudMaintenanceTarget(projectId);
  const saveCloudMigration = useSaveCloudMigrationTarget(projectId);
  const saveConsulting = useSaveConsultingTarget(projectId);

  switch (projectTypeCode) {
    case "DEVELOPMENT":
      return {
        isLoaded: development.status === "success",
        seed: development.data ? fromDevelopmentTarget(development.data) : {},
        isSaving: saveDevelopment.isPending,
        submit: (m: Record<string, string>) =>
          saveWithBanner(saveDevelopment, toDevelopmentPayload(m), showSuccess, showError),
      };
    case "SUPPORT":
      return {
        isLoaded: support.status === "success",
        seed: support.data ? fromSupportTarget(support.data) : {},
        isSaving: saveSupport.isPending,
        submit: (m: Record<string, string>) =>
          saveWithBanner(saveSupport, toSupportPayload(m), showSuccess, showError),
      };
    case "PROFESSIONAL_STAFFING":
      return {
        isLoaded: staffing.status === "success",
        seed: staffing.data ? fromStaffingTarget(staffing.data) : {},
        isSaving: saveStaffing.isPending,
        submit: (m: Record<string, string>) =>
          saveWithBanner(saveStaffing, toStaffingPayload(m), showSuccess, showError),
      };
    case "TESTING":
      return {
        isLoaded: testing.status === "success",
        seed: testing.data ? fromTestingTarget(testing.data) : {},
        isSaving: saveTesting.isPending,
        submit: (m: Record<string, string>) =>
          saveWithBanner(saveTesting, toTestingPayload(m), showSuccess, showError),
      };
    case "CLOUD_MAINTENANCE":
      return {
        isLoaded: cloudMaintenance.status === "success",
        seed: cloudMaintenance.data ? fromCloudMaintenanceTarget(cloudMaintenance.data) : {},
        isSaving: saveCloudMaintenance.isPending,
        submit: (m: Record<string, string>) =>
          saveWithBanner(saveCloudMaintenance, toCloudMaintenancePayload(m), showSuccess, showError),
      };
    case "CLOUD_MIGRATION":
      return {
        isLoaded: cloudMigration.status === "success",
        seed: cloudMigration.data ? fromCloudMigrationTarget(cloudMigration.data) : {},
        isSaving: saveCloudMigration.isPending,
        submit: (m: Record<string, string>) =>
          saveWithBanner(saveCloudMigration, toCloudMigrationPayload(m), showSuccess, showError),
      };
    case "CONSULTING":
      return {
        isLoaded: consulting.status === "success",
        seed: consulting.data ? fromConsultingTarget(consulting.data) : {},
        isSaving: saveConsulting.isPending,
        submit: (m: Record<string, string>) =>
          saveWithBanner(saveConsulting, toConsultingPayload(m), showSuccess, showError),
      };
    default:
      return { isLoaded: false, seed: {} as Record<string, string>, isSaving: false, submit: () => {} };
  }
}

export function MeasurementTabs() {
  const projectId = useNewProjectId();
  const { data: project } = useProject(projectId);
  const { data: projectTypes } = useProjectTypes();
  const projectTypeCode = projectTypes?.find((t) => t.id === project?.project_type_id)?.code;
  const activeTab = TABS.find((t) => t.code === projectTypeCode);

  const target = useActiveTarget(projectId, projectTypeCode);
  const { m, set, setAll } = useMeasures();

  // Seeds the form from the saved target once per project/type, so it
  // doesn't clobber in-progress edits on every re-render or background
  // refetch (the refetch after a save echoes back the same values anyway).
  const seededKeyRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!projectId || !projectTypeCode || !target.isLoaded) return;
    const seedKey = `${projectId}:${projectTypeCode}`;
    if (seededKeyRef.current === seedKey) return;
    setAll(target.seed);
    seededKeyRef.current = seedKey;
  }, [projectId, projectTypeCode, target.isLoaded, target.seed, setAll]);

  if (!activeTab) {
    return (
      <p className="text-sm text-slate-500">
        Set a Project Type on the Project Profile screen to see its measurement fields.
      </p>
    );
  }

  const Active = activeTab.content;

  return (
    <div>
      <div role="tablist" className="flex gap-8 border-b border-slate-200">
        <span
          role="tab"
          aria-selected="true"
          className="-mb-px border-b-2 border-[#1a4a7a] pb-3 text-sm font-semibold whitespace-nowrap text-[#1a4a7a]"
        >
          {activeTab.label}
        </span>
      </div>

      <div className="mt-8">
        <Active m={m} set={set} />
      </div>

      <div className="mt-10 flex flex-wrap items-start justify-between gap-4">
        <p className="flex max-w-2xl items-start gap-2 text-sm text-slate-500">
          <Target className="mt-0.5 size-4 shrink-0" />
          We&apos;re at the planning stage — only target metrics can be set;
          actuals follow once the project is underway.
        </p>
        <div className="flex shrink-0 gap-3">
          <Button
            onClick={() => target.submit(m)}
            disabled={!projectId || target.isSaving}
            className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {target.isSaving ? "Saving…" : "Save Targets"}
          </Button>
        </div>
      </div>
    </div>
  );
}
