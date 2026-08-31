"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { HeartPulse } from "lucide-react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/forms/empty-state";
import { useNewProjectId } from "@/stores/new-project-ui";
import { useProject } from "@/lib/api/projects";
import { useBaselinePeriodId } from "@/lib/period-utils";
import { usePageBanner } from "@/stores/page-banner";
import {
  useCreateHealthDeclaration,
  useHealthDeclarations,
  useUpdateHealthDeclaration,
  type HealthDeclaration as ApiHealthDeclaration,
  type HealthRating as ApiHealthRating,
} from "@/lib/api/health-declarations";
import { HEALTH_CATEGORIES } from "@/lib/health-categories";
import { HealthItemsTab } from "@/components/project-charter/health-items-tab";

import { AiFieldBadge } from "@/components/ai/ai-field-badge";
import { useAiFieldBinding } from "@/components/ai/use-ai-field-binding";

export type HealthRating = "green" | "amber" | "potential-red" | "red";

const HEALTH_LEVELS: {
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

// Severity order for roll-ups: worst rating wins.
const SEVERITY: HealthRating[] = ["green", "amber", "potential-red", "red"];

function worstOf(ratings: HealthRating[]): HealthRating {
  return ratings.reduce((worst, rating) =>
    SEVERITY.indexOf(rating) > SEVERITY.indexOf(worst) ? rating : worst
  );
}

// UI uses kebab-case rating keys; the API's HealthRating enum is "Red" /
// "Potential Red" / "Amber" / "Green". Exported so other health-adjacent
// screens (e.g. de-assessment-form.tsx) share the same conversion.
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

const DEFAULT_RATINGS: Record<CategoryKey, HealthRating> = {
  "core-delivery": "green",
  people: "green",
  operational: "green",
  customer: "green",
  financial: "green",
  compliance: "green",
};

function fromDeclaration(declaration: ApiHealthDeclaration) {
  const ratings = {} as Record<CategoryKey, HealthRating>;
  for (const category of CATEGORIES) {
    ratings[category.key] = RATING_FROM_API[declaration[category.ratingField]];
  }
  return { ratings };
}

// AI suggestion field_keys use the API's flat, snake_case names
// (core_delivery_rating, ...) — matching HealthDeclarationCreate's payload
// shape, same convention as ProjectPayload's keys elsewhere. `ratings`
// below is UI-shaped (kebab-case CategoryKey, UI-cased HealthRating) for
// the picker component, so this is a thin adapter view over that same
// state, purely for useAiFieldBinding's benefit — rating values round-trip
// through RATING_TO_API/RATING_FROM_API same as the submit payload does.
// Descriptions are no longer part of this binding — a category's RAG notes
// are now a multi-row register (HealthItemsTab), and an AI suggestion can't
// cleanly target one row of a list, so that field's AI wiring was dropped
// (the rating picker's AI badge below is unaffected).
type HealthAiValues = Record<(typeof CATEGORIES)[number]["ratingField"], string>;

// Owns all state + the submit mutation; the SelfAssessmentForm action bar
// (in charter-form.tsx) calls `submit` from the same hook instance so the
// Submit button acts on the values rendered here.
export function useHealthDeclarationForm() {
  const projectId = useNewProjectId();
  const router = useRouter();
  const pathname = usePathname();
  const { data: project } = useProject(projectId);
  const { data: declarations } = useHealthDeclarations(projectId);
  const createDeclaration = useCreateHealthDeclaration(projectId);
  const updateDeclaration = useUpdateHealthDeclaration(projectId);

  // The wizard's initial declaration isn't tied to a real calendar period —
  // it references the sentinel "Baseline" reporting_periods row (see
  // 04_health_declarations.sql) instead, so there's no period picker here.
  // The recurring monthly review lives on the Project Charter's Self
  // Assessment tab (project-charter/health-declaration.tsx), which does
  // show a Reporting Month picker. HealthItemsTab (shared with that screen)
  // reads its period from ?period= in the URL, so once the baseline id
  // resolves it's synced into the URL here rather than passed as a prop.
  const periodId = useBaselinePeriodId() ?? "";
  const existing = declarations?.find((d) => d.period_id === periodId);

  React.useEffect(() => {
    if (periodId) {
      router.replace(`${pathname}?period=${periodId}`, { scroll: false });
    }
  }, [periodId, pathname, router]);

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

  const setRating = (categoryKey: CategoryKey, value: HealthRating) =>
    setRatings((prev) => ({ ...prev, [categoryKey]: value }));

  const aiValues = {} as HealthAiValues;
  for (const category of CATEGORIES) {
    aiValues[category.ratingField] = RATING_TO_API[ratings[category.key]];
  }
  function setAiValue<K extends keyof HealthAiValues>(fieldKey: K) {
    return (value: HealthAiValues[K]) => {
      const category = CATEGORIES.find((c) => c.ratingField === fieldKey);
      if (!category) return;
      setRating(category.key, RATING_FROM_API[value as ApiHealthRating]);
    };
  }
  const { ai, fieldAi, setAndClear } = useAiFieldBinding(
    projectId,
    "self_assessment",
    periodId || null,
    aiValues,
    setAiValue
  );

  const declaredOverall = worstOf(Object.values(ratings));
  const deAssessedHealth = project?.de_assessed_project_health
    ? RATING_FROM_API[project.de_assessed_project_health]
    : null;
  const overall = deAssessedHealth ? worstOf([declaredOverall, deAssessedHealth]) : declaredOverall;
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const submit = () => {
    if (!projectId || !periodId) return;
    const fields = {
      core_delivery_rating: RATING_TO_API[ratings["core-delivery"]],
      people_rating: RATING_TO_API[ratings.people],
      operational_rating: RATING_TO_API[ratings.operational],
      customer_rating: RATING_TO_API[ratings.customer],
      financial_rating: RATING_TO_API[ratings.financial],
      compliance_rating: RATING_TO_API[ratings.compliance],
    };
    const onSuccess = () => {
      ai.resolveAll();
      showSuccess("Self Assessment Submitted Successfully");
    };
    const onError = (err: unknown) =>
      showError(err instanceof Error ? err.message : "Failed to submit self assessment.");

    if (existing) {
      updateDeclaration.mutate({ id: existing.id, payload: fields }, { onSuccess, onError });
    } else {
      createDeclaration.mutate({ period_id: periodId, ...fields }, { onSuccess, onError });
    }
  };

  return {
    projectId,
    periodId: periodId || null,
    ratings,
    setRating,
    declaredOverall,
    deAssessedHealth,
    overall,
    submit,
    isSubmitting: createDeclaration.isPending || updateDeclaration.isPending,
    ai,
    fieldAi,
    setAndClear,
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
  const { ratings } = form;
  const [tab, setTab] = React.useState<(typeof HEALTH_CATEGORIES)[number]["label"]>(HEALTH_CATEGORIES[0].label);
  const activeTab = HEALTH_CATEGORIES.find((t) => t.label === tab)!;
  const activeCategory = CATEGORIES.find((c) => c.name === activeTab.category)!;
  const ratingAi = form.fieldAi(activeCategory.ratingField);

  if (!form.projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
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
          <div className="flex items-center gap-2">
            {ratingAi ? <AiFieldBadge suggestion={ratingAi.suggestion} onRevert={ratingAi.onRevert} /> : null}
            <HealthPicker
              value={ratings[activeCategory.key]}
              onChange={(value) => form.setAndClear(activeCategory.ratingField)(RATING_TO_API[value])}
            />
          </div>
        </div>

        <div className="mt-6">
          <HealthItemsTab category={activeTab.category} title={activeTab.label} icon={activeTab.icon} />
        </div>
      </div>
    </div>
  );
}
