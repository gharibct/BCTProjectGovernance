"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Activity, HeartPulse } from "lucide-react";

import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  useProject,
  useUpdateProject,
  type ApplicablePhase,
  type ProjectStatus,
} from "@/lib/api/projects";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { currentPeriod } from "@/lib/period-utils";
import {
  useCreateHealthDeclaration,
  useHealthDeclarations,
  useUpdateHealthDeclaration,
  type HealthDeclaration as ApiHealthDeclaration,
  type HealthRating as ApiHealthRating,
} from "@/lib/api/health-declarations";
import { HEALTH_CATEGORIES } from "@/lib/health-categories";
import { HealthItemsTab } from "./health-items-tab";

import { Field, SectionCard } from "@/components/forms/form-primitives";
import { usePageBanner } from "@/stores/page-banner";

export type HealthRating = "green" | "amber" | "potential-red" | "red";

export const HEALTH_LEVELS: {
  value: HealthRating;
  label: string;
  activeClass: string;
  pillClass: string;
  dotClass: string;
}[] = [
  {
    value: "green",
    label: "Green",
    activeClass: "bg-emerald-600 text-white",
    pillClass: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dotClass: "bg-emerald-500",
  },
  {
    value: "amber",
    label: "Amber",
    activeClass: "bg-amber-500 text-white",
    pillClass: "bg-amber-50 text-amber-700 ring-amber-200",
    dotClass: "bg-amber-400",
  },
  {
    value: "potential-red",
    label: "Potential Red",
    activeClass: "bg-orange-600 text-white",
    pillClass: "bg-orange-50 text-orange-700 ring-orange-200",
    dotClass: "bg-orange-500",
  },
  {
    value: "red",
    label: "Red",
    activeClass: "bg-red-600 text-white",
    pillClass: "bg-red-50 text-red-700 ring-red-200",
    dotClass: "bg-red-500",
  },
];

const APPLICABLE_PHASES: ApplicablePhase[] = [
  "Requirement",
  "Design",
  "CUT",
  "Build & Deployment",
  "Testing",
  "UAT",
  "Warranty",
  "Support",
];

const PROJECT_STATUSES: ProjectStatus[] = [
  "Draft",
  "Approved",
  "Hold",
  "Closed",
  "Open Only for Billing",
];

export const CATEGORIES = [
  {
    key: "core-delivery",
    name: "Core Delivery",
    covers: "Scope · Cost · Schedule · Quality · Contractual SLA · KPI",
    ratingField: "core_delivery_rating",
    descriptionField: "core_delivery_description",
  },
  {
    key: "people",
    name: "People",
    covers: "Resourcing · Fulfilment · Skilling · Performance · Attrition",
    ratingField: "people_rating",
    descriptionField: "people_description",
  },
  {
    key: "operational",
    name: "Operational",
    covers:
      "PID Creation · Extension · Contract Extension · PO · Projects without contract · Payment · Invoices · Timesheet",
    ratingField: "operational_rating",
    descriptionField: "operational_description",
  },
  {
    key: "customer",
    name: "Customer",
    covers: "Relation · Pulse · Feedback · Opportunities · Business",
    ratingField: "customer_rating",
    descriptionField: "customer_description",
  },
  {
    key: "financial",
    name: "Financial",
    covers: "Forecast · Margin · MIP",
    ratingField: "financial_rating",
    descriptionField: "financial_description",
  },
  {
    key: "compliance",
    name: "Compliance",
    covers: "Security · Infrastructure · Vendor Management",
    ratingField: "compliance_rating",
    descriptionField: "compliance_description",
  },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export const DEFAULT_RATINGS: Record<CategoryKey, HealthRating> = {
  "core-delivery": "green",
  people: "green",
  operational: "green",
  customer: "green",
  financial: "green",
  compliance: "green",
};

// Severity order for roll-ups: worst rating wins.
const SEVERITY: HealthRating[] = ["green", "amber", "potential-red", "red"];

export function worstOf(ratings: HealthRating[]): HealthRating {
  return ratings.reduce((worst, rating) =>
    SEVERITY.indexOf(rating) > SEVERITY.indexOf(worst) ? rating : worst
  );
}

// UI uses kebab-case rating keys; the API's HealthRating enum is "Red" /
// "Potential Red" / "Amber" / "Green".
export const RATING_TO_API: Record<HealthRating, ApiHealthRating> = {
  green: "Green",
  amber: "Amber",
  "potential-red": "Potential Red",
  red: "Red",
};
export const RATING_FROM_API: Record<ApiHealthRating, HealthRating> = {
  Green: "green",
  Amber: "amber",
  "Potential Red": "potential-red",
  Red: "red",
};

function fromDeclaration(declaration: ApiHealthDeclaration) {
  const ratings = {} as Record<CategoryKey, HealthRating>;
  for (const category of CATEGORIES) {
    ratings[category.key] = RATING_FROM_API[declaration[category.ratingField]];
  }
  return { ratings };
}

// Owns all state + the submit mutation; the SelfAssessmentForm action bar
// (in charter-form.tsx) calls `submit` from the same hook instance so the
// Save button acts on the values rendered here.
export function useHealthDeclarationForm() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;
  const { data: project } = useProject(projectId);
  const { data: periods = [] } = useReportingPeriods();
  const { data: declarations } = useHealthDeclarations(projectId);
  const createDeclaration = useCreateHealthDeclaration(projectId);
  const updateDeclaration = useUpdateHealthDeclaration(projectId);
  const updateProject = useUpdateProject(projectId);

  // RAG Status is part of both Weekly and Monthly reporting — it follows
  // whichever period is selected (?period=, forwarded by ProjectNav same as
  // every other reporting screen), falling back to the current month when
  // reached with no period in the URL (e.g. a direct/bookmarked visit).
  const periodId = useSearchParams().get("period") ?? currentPeriod(periods, "Monthly")?.id ?? "";
  const existing = declarations?.find((d) => d.period_id === periodId);

  const [ratings, setRatings] = React.useState<Record<CategoryKey, HealthRating>>(DEFAULT_RATINGS);
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);

  const key = existing ? existing.id : `blank:${periodId}`;
  if (key !== syncedFor) {
    setSyncedFor(key);
    if (existing) {
      const seeded = fromDeclaration(existing);
      setRatings(seeded.ratings);
    } else {
      setRatings(DEFAULT_RATINGS);
    }
  }

  const [applicablePhase, setApplicablePhase] = React.useState<ApplicablePhase | "">("");
  const [projectStatus, setProjectStatus] = React.useState<ProjectStatus | "">("");
  const [syncedProjectFor, setSyncedProjectFor] = React.useState<string | null>(null);
  const projectKey = project ? project.id : projectId ? null : "none";
  if (projectKey !== null && projectKey !== syncedProjectFor) {
    setSyncedProjectFor(projectKey);
    if (project) {
      setApplicablePhase(project.applicable_phase ?? "");
      setProjectStatus(project.project_status ?? "");
    }
  }

  const setRating = (categoryKey: CategoryKey, value: HealthRating) =>
    setRatings((prev) => ({ ...prev, [categoryKey]: value }));

  const declaredOverall = worstOf(Object.values(ratings));
  const deAssessedHealth = project?.de_assessed_project_health
    ? RATING_FROM_API[project.de_assessed_project_health]
    : null;
  const overall = deAssessedHealth ? worstOf([declaredOverall, deAssessedHealth]) : declaredOverall;

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const submit = async () => {
    if (!projectId || !periodId) return;
    setIsSubmitting(true);
    try {
      const fields = {
        core_delivery_rating: RATING_TO_API[ratings["core-delivery"]],
        people_rating: RATING_TO_API[ratings.people],
        operational_rating: RATING_TO_API[ratings.operational],
        customer_rating: RATING_TO_API[ratings.customer],
        financial_rating: RATING_TO_API[ratings.financial],
        compliance_rating: RATING_TO_API[ratings.compliance],
      };
      await Promise.all([
        existing
          ? updateDeclaration.mutateAsync({ id: existing.id, payload: fields })
          : createDeclaration.mutateAsync({ period_id: periodId, ...fields }),
        updateProject.mutateAsync({
          applicable_phase: applicablePhase || undefined,
          project_status: projectStatus || undefined,
        }),
      ]);
      showSuccess("RAG Status Saved Successfully");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save self assessment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    projectId,
    ratings,
    setRating,
    applicablePhase,
    setApplicablePhase,
    projectStatus,
    setProjectStatus,
    declaredOverall,
    deAssessedHealth,
    overall,
    submit,
    isSubmitting: isSubmitting || createDeclaration.isPending || updateDeclaration.isPending,
  };
}

export function HealthPicker({
  value,
  onChange,
}: {
  value: HealthRating;
  onChange: (value: HealthRating) => void;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
    >
      {HEALTH_LEVELS.map((level) => (
        <button
          key={level.value}
          type="button"
          role="radio"
          aria-checked={value === level.value}
          onClick={() => onChange(level.value)}
          className={cn(
            "flex h-full items-center gap-2 rounded-md px-3 text-xs font-semibold whitespace-nowrap transition-colors",
            value === level.value
              ? level.activeClass
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              value === level.value ? "bg-white/80" : level.dotClass
            )}
          />
          {level.label}
        </button>
      ))}
    </div>
  );
}

export function HealthPill({ rating }: { rating: HealthRating }) {
  const level = HEALTH_LEVELS.find((l) => l.value === rating)!;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1",
        level.pillClass
      )}
    >
      <span className={cn("size-2 rounded-full", level.dotClass)} />
      {level.label}
    </span>
  );
}

export function HealthDeclaration({
  form,
}: {
  form: ReturnType<typeof useHealthDeclarationForm>;
}) {
  const { ratings, setRating, applicablePhase, setApplicablePhase, projectStatus, setProjectStatus } = form;
  const [tab, setTab] = React.useState<(typeof HEALTH_CATEGORIES)[number]["label"]>(HEALTH_CATEGORIES[0].label);
  const activeTab = HEALTH_CATEGORIES.find((t) => t.label === tab)!;
  const activeCategory = CATEGORIES.find((c) => c.name === activeTab.category)!;

  if (!form.projectId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No project selected.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={Activity} title="Treatment">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field label="Applicable Phase" htmlFor="applicable-phase">
            <NativeSelect
              id="applicable-phase"
              value={applicablePhase}
              onChange={(e) => setApplicablePhase(e.target.value as ApplicablePhase)}
            >
              <option value="" disabled>
                Select…
              </option>
              {APPLICABLE_PHASES.map((phase) => (
                <option key={phase}>{phase}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Project Status" htmlFor="project-status">
            <NativeSelect
              id="project-status"
              value={projectStatus}
              onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}
            >
              <option value="" disabled>
                Select…
              </option>
              {PROJECT_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </SectionCard>

      <div>
        <div className="flex items-center gap-3 pb-4 text-lg font-bold text-slate-900">
          <HeartPulse className="size-5 text-slate-700" />
          Delivery Declared Project Health
        </div>
        <div role="tablist" className="flex gap-8 border-b border-slate-200">
          {HEALTH_CATEGORIES.map((t) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={tab === t.label}
              onClick={() => setTab(t.label)}
              className={cn(
                "-mb-px border-b-2 pb-3 text-sm font-semibold whitespace-nowrap transition-colors",
                tab === t.label
                  ? "border-[#1a4a7a] text-[#1a4a7a]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800">{activeCategory.name}</p>
            <p className="mt-0.5 text-xs text-slate-400">{activeCategory.covers}</p>
          </div>
          <HealthPicker
            value={ratings[activeCategory.key]}
            onChange={(value) => setRating(activeCategory.key, value)}
          />
        </div>

        <div className="mt-6">
          <HealthItemsTab category={activeTab.category} title={activeTab.label} icon={activeTab.icon} />
        </div>
      </div>
    </div>
  );
}
