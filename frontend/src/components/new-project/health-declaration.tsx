"use client";

import * as React from "react";
import { HeartPulse, ShieldCheck } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { AutoBadge, Field, SectionCard } from "@/components/forms/form-primitives";

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

const CATEGORIES = [
  {
    key: "core-delivery",
    name: "Core Delivery",
    covers: "Scope · Cost · Schedule · Quality · Contractual SLA · KPI",
  },
  {
    key: "people",
    name: "People",
    covers: "Resourcing · Fulfilment · Skilling · Performance · Attrition",
  },
  {
    key: "operational",
    name: "Operational",
    covers:
      "PID Creation · Extension · Contract Extension · PO · Projects without contract · Payment · Invoices · Timesheet",
  },
  {
    key: "customer",
    name: "Customer",
    covers: "Relation · Pulse · Feedback · Opportunities · Business",
  },
  {
    key: "financial",
    name: "Financial",
    covers: "Forecast · Margin · MIP",
  },
  {
    key: "compliance",
    name: "Compliance",
    covers: "Security · Infrastructure · Vendor Management",
  },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

function HealthPicker({
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

// DE Assessed Project Health is read-only here — it comes from the latest
// DE Assessment Form record.
const DE_ASSESSED_HEALTH: HealthRating = "amber";

export function HealthDeclaration() {
  const [ratings, setRatings] = React.useState<Record<CategoryKey, HealthRating>>({
    "core-delivery": "green",
    people: "amber",
    operational: "green",
    customer: "green",
    financial: "green",
    compliance: "green",
  });

  const declaredOverall = worstOf(Object.values(ratings));
  const overall = worstOf([declaredOverall, DE_ASSESSED_HEALTH]);

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
                onChange={(value) =>
                  setRatings((prev) => ({ ...prev, [category.key]: value }))
                }
              />
              <Input
                aria-label={`${category.name} health description`}
                placeholder="Short description…"
                className="h-10"
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={ShieldCheck} title="Overall Health">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
          <Field
            label="Delivery Declared Overall"
            badge={<AutoBadge label="Auto — any Red rolls up" />}
          >
            <div className="flex h-11 items-center">
              <HealthPill rating={declaredOverall} />
            </div>
          </Field>
          <Field
            label="DE Assessed Project Health"
            badge={<AutoBadge label="From DE Assessment" />}
          >
            <div className="flex h-11 items-center">
              <HealthPill rating={DE_ASSESSED_HEALTH} />
            </div>
          </Field>
          <Field
            label="Overall Project Health"
            badge={<AutoBadge label="Auto — highest severity" />}
          >
            <div className="flex h-11 items-center">
              <HealthPill rating={overall} />
            </div>
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}
