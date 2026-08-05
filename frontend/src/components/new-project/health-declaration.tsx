"use client";

import * as React from "react";
import { toast } from "sonner";
import { HeartPulse } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useNewProjectId } from "@/stores/new-project-ui";
import { useProject } from "@/lib/api/projects";
import {
  useCreateHealthDeclaration,
  useLatestHealthDeclaration,
  type HealthDeclaration as ApiHealthDeclaration,
  type HealthRating as ApiHealthRating,
} from "@/lib/api/health-declarations";

import { SectionCard } from "@/components/forms/form-primitives";

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

const EMPTY_DESCRIPTIONS: Record<CategoryKey, string> = {
  "core-delivery": "",
  people: "",
  operational: "",
  customer: "",
  financial: "",
  compliance: "",
};

function fromDeclaration(declaration: ApiHealthDeclaration) {
  const ratings = {} as Record<CategoryKey, HealthRating>;
  const descriptions = {} as Record<CategoryKey, string>;
  for (const category of CATEGORIES) {
    ratings[category.key] = RATING_FROM_API[declaration[category.ratingField]];
    descriptions[category.key] = declaration[category.descriptionField] ?? "";
  }
  return { ratings, descriptions };
}

// Owns all state + the submit mutation; the SelfAssessmentForm action bar
// (in charter-form.tsx) calls `submit` from the same hook instance so the
// Submit button acts on the values rendered here.
export function useHealthDeclarationForm() {
  const projectId = useNewProjectId();
  const { data: project } = useProject(projectId);
  const { data: latest } = useLatestHealthDeclaration(projectId);
  const createDeclaration = useCreateHealthDeclaration(projectId);

  const [ratings, setRatings] = React.useState<Record<CategoryKey, HealthRating>>(DEFAULT_RATINGS);
  const [descriptions, setDescriptions] = React.useState<Record<CategoryKey, string>>(EMPTY_DESCRIPTIONS);
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);

  const key = latest ? latest.id : latest === null ? "none" : null;
  if (key !== null && key !== syncedFor) {
    setSyncedFor(key);
    if (latest) {
      const seeded = fromDeclaration(latest);
      setRatings(seeded.ratings);
      setDescriptions(seeded.descriptions);
    }
  }

  const setRating = (categoryKey: CategoryKey, value: HealthRating) =>
    setRatings((prev) => ({ ...prev, [categoryKey]: value }));
  const setDescription = (categoryKey: CategoryKey, value: string) =>
    setDescriptions((prev) => ({ ...prev, [categoryKey]: value }));

  const declaredOverall = worstOf(Object.values(ratings));
  const deAssessedHealth = project?.de_assessed_project_health
    ? RATING_FROM_API[project.de_assessed_project_health]
    : null;
  const overall = deAssessedHealth ? worstOf([declaredOverall, deAssessedHealth]) : declaredOverall;

  const submit = () => {
    if (!projectId) return;
    createDeclaration.mutate({
      declaration_date: new Date().toISOString().slice(0, 10),
      core_delivery_rating: RATING_TO_API[ratings["core-delivery"]],
      core_delivery_description: descriptions["core-delivery"] || undefined,
      people_rating: RATING_TO_API[ratings.people],
      people_description: descriptions.people || undefined,
      operational_rating: RATING_TO_API[ratings.operational],
      operational_description: descriptions.operational || undefined,
      customer_rating: RATING_TO_API[ratings.customer],
      customer_description: descriptions.customer || undefined,
      financial_rating: RATING_TO_API[ratings.financial],
      financial_description: descriptions.financial || undefined,
      compliance_rating: RATING_TO_API[ratings.compliance],
      compliance_description: descriptions.compliance || undefined,
    }, {
      onSuccess: () => toast.success("Self Assessment Submitted Successfully"),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Failed to submit self assessment."),
    });
  };

  return {
    projectId,
    ratings,
    setRating,
    descriptions,
    setDescription,
    declaredOverall,
    deAssessedHealth,
    overall,
    submit,
    isSubmitting: createDeclaration.isPending,
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
  const { ratings, setRating, descriptions, setDescription } = form;

  if (!form.projectId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Create the project on the Project Profile tab first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={HeartPulse} title="Delivery Declared Project Health">
        <div className="flex flex-col divide-y divide-slate-100">
          {CATEGORIES.map((category) => (
            <div
              key={category.key}
              className="grid grid-cols-1 items-center gap-4 py-5 first:pt-0 last:pb-0 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,20rem)]"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">
                  {category.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {category.covers}
                </p>
              </div>
              <HealthPicker
                value={ratings[category.key]}
                onChange={(value) => setRating(category.key, value)}
              />
              <Input
                aria-label={`${category.name} health description`}
                placeholder="Short description…"
                className="h-10"
                value={descriptions[category.key]}
                onChange={(e) => setDescription(category.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
