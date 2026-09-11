"use client";

import * as React from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNewProjectId } from "@/stores/new-project-ui";
import { usePageBanner } from "@/stores/page-banner";
import { useProject } from "@/lib/api/projects";
import {
  resolveBenchmark,
  useMetricReferenceLookup,
  type MetricReferenceLookup,
} from "@/lib/api/metric-reference";
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
import { numericBenchmark, useMeasures } from "./shared";
import { StaffingTab, fromStaffingTarget, toStaffingPayload } from "./staffing-form";
import { SupportTab, fromSupportTarget, toSupportPayload } from "./support-form";
import { TestingTab, fromTestingTarget, toTestingPayload } from "./testing-form";

// Target form-field name -> metric_reference.yaml key, per project type code
// (mirrors the `metricKey=` props on each tab's MetricTiles). Drives both the
// config-benchmark prefill of empty fields and the config min/max check on Save.
// Consulting has no yaml metrics, so its entries never resolve.
const METRIC_FIELDS: Record<string, Record<string, string>> = {
  DEVELOPMENT: {
    targetProductivity: "productivity",
    targetEffortVariation: "effort_variation_pct",
    targetSpi: "schedule_performance_index",
    targetCpi: "cost_performance_index",
    targetDefectLeakage: "defect_leakage_pct",
    targetExecCoverage: "test_execution_coverage_pct",
    targetPassRate: "test_pass_rate_pct",
    targetCodeCoverage: "code_coverage_pct",
  },
  SUPPORT: {
    targetMttrP1: "incident_mttr_hours",
    targetMttrP2: "incident_mttr_hours",
    targetMttrP3: "incident_mttr_hours",
    targetMttrSr: "service_request_mttr_hours",
    targetMttrUc: "user_clarification_mttr_hours",
    targetSlaP1: "incident_sla_compliance_pct",
    targetSlaP2: "incident_sla_compliance_pct",
    targetSlaP3: "incident_sla_compliance_pct",
  },
  PROFESSIONAL_STAFFING: {
    "target-avg-resp-p1": "avg_response_time_hours",
    "target-avg-resp-p2": "avg_response_time_hours",
    "target-avg-resp-p3": "avg_response_time_hours",
    "target-avg-resp-p4": "avg_response_time_hours",
    targetProfilesQualifying: "pct_profiles_qualifying",
    targetCandidatesJoining: "pct_candidates_joining",
    "target-lead-time-p1": "avg_lead_time_days",
    "target-lead-time-p2": "avg_lead_time_days",
    "target-lead-time-p3": "avg_lead_time_days",
    "target-lead-time-p4": "avg_lead_time_days",
  },
  TESTING: {
    targetExecCoverage: "test_execution_coverage_pct",
    targetPassRate: "test_pass_rate_pct",
    targetAutomationCoverage: "automation_coverage_pct",
    targetDesignProductivity: "test_design_productivity",
    targetExecProductivity: "test_execution_productivity",
  },
  CLOUD_MAINTENANCE: {
    targetServiceAvailability: "service_availability_pct",
    targetAppAvailability: "application_availability_pct",
  },
  CLOUD_MIGRATION: {
    targetAppsMigrated: "applications_migrated_pct",
    targetSuccessRate: "migration_success_rate_pct",
    targetDowntime: "migration_downtime_hours",
  },
  CONSULTING: {
    targetEffortVariation: "effort_variation_pct",
    targetSpi: "schedule_performance_index",
    targetCpi: "cost_performance_index",
  },
};

// Fills any empty target field that has a plain-number config benchmark with
// that benchmark, so an untouched field defaults to the recommended value and
// is saved as the target unless the user changes it. Returns `seed` unchanged
// while the (static, session-cached) reference data is still loading.
// Productivity's benchmark varies by the project's Size Unit (CP/FP/LOC/SP),
// so it's resolved against `seed.sizeUnit` (default "FP", matching the form's
// Size Unit select); every other metric resolves to its single scalar.
function applyBenchmarkDefaults(
  seed: Record<string, string>,
  fieldMap: Record<string, string>,
  reference: MetricReferenceLookup | undefined,
): Record<string, string> {
  const out = { ...seed };
  if (!reference) return out;
  const unit = seed.sizeUnit?.trim() || "FP";
  for (const [field, metricKey] of Object.entries(fieldMap)) {
    if (out[field]?.trim()) continue;
    const benchmark = numericBenchmark(resolveBenchmark(reference[metricKey], unit)?.benchmark_value);
    if (benchmark !== null) out[field] = benchmark;
  }
  return out;
}

// Per-field message for any entered target outside its config [min, max]
// (inclusive). A blank/non-numeric bound means that side is unbounded.
function validateTargetRanges(
  m: Record<string, string>,
  fieldMap: Record<string, string>,
  reference: MetricReferenceLookup | undefined,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!reference) return errors;
  for (const [field, metricKey] of Object.entries(fieldMap)) {
    const raw = m[field]?.trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    const entry = reference[metricKey];
    if (!entry) continue;
    const minStr = numericBenchmark(entry.min_value);
    const maxStr = numericBenchmark(entry.max_value);
    const min = minStr === null ? null : Number(minStr);
    const max = maxStr === null ? null : Number(maxStr);
    if (min !== null && value < min) {
      errors[field] = max !== null ? `Must be between ${min} and ${max}` : `Must be at least ${min}`;
    } else if (max !== null && value > max) {
      errors[field] = min !== null ? `Must be between ${min} and ${max}` : `Must be at most ${max}`;
    }
  }
  return errors;
}

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
  const reference = useMetricReferenceLookup(projectTypeCode ?? "");
  const showError = usePageBanner((state) => state.showError);

  const target = useActiveTarget(projectId, projectTypeCode);
  const { m, set, setValue, setAll } = useMeasures();
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // Editing a field clears its own out-of-range message.
  const setField = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    set(key)(e);
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = () => {
    const errs = validateTargetRanges(m, METRIC_FIELDS[projectTypeCode ?? ""] ?? {}, reference);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      showError("Some targets are outside the allowed range — fix the highlighted fields.");
      return;
    }
    target.submit(m);
  };

  // Seeds the form from the saved target (plus config benchmark defaults for
  // empty fields) once per project/type, so it doesn't clobber in-progress
  // edits on every re-render or background refetch (the refetch after a save
  // echoes back the same values anyway). Re-seeds once when the reference data
  // arrives so the benchmark defaults land even if that query resolves after
  // the target — a rare sub-second window in which a typed value can be lost.
  const seededKeyRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!projectId || !projectTypeCode || !target.isLoaded) return;
    const seedKey = `${projectId}:${projectTypeCode}:${reference !== undefined}`;
    if (seededKeyRef.current === seedKey) return;
    setAll(applyBenchmarkDefaults(target.seed, METRIC_FIELDS[projectTypeCode] ?? {}, reference));
    seededKeyRef.current = seedKey;
  }, [projectId, projectTypeCode, target.isLoaded, target.seed, reference, setAll]);

  // Development only: Productivity's recommended default tracks the Size Unit.
  // When the user switches CP/FP/LOC/SP and the Productivity target is still
  // untouched (empty, or still the previous unit's benchmark), swap in the new
  // unit's benchmark — the same value the (i) popover shows. A hand-entered
  // value never matches the previous default, so it's left alone.
  const prevProductivityBenchmarkRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (projectTypeCode !== "DEVELOPMENT" || !reference) return;
    const unit = m.sizeUnit?.trim() || "FP";
    const next = numericBenchmark(resolveBenchmark(reference["productivity"], unit)?.benchmark_value);
    const prev = prevProductivityBenchmarkRef.current;
    prevProductivityBenchmarkRef.current = next;
    if (next === null || next === prev) return;
    const current = m.targetProductivity?.trim() ?? "";
    if (current === "" || (prev !== null && current === prev)) {
      setValue("targetProductivity", next);
    }
  }, [m.sizeUnit, m.targetProductivity, projectTypeCode, reference, setValue]);

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
        <Active m={m} set={setField} reference={reference} errors={fieldErrors} />
      </div>

      <div className="mt-10 flex flex-wrap items-start justify-between gap-4">
        <p className="flex max-w-2xl items-start gap-2 text-sm text-slate-500">
          <Target className="mt-0.5 size-4 shrink-0" />
          We&apos;re at the planning stage — only target metrics can be set;
          actuals follow once the project is underway.
        </p>
        <div className="flex shrink-0 gap-3">
          <Button
            onClick={handleSave}
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
