"use client";

import { ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  HEALTH_LEVELS,
  RATING_FROM_API,
  type HealthRating,
} from "@/components/project-charter/health-declaration";
import { useReviewHealthDeclaration, type ReviewScope } from "@/lib/api/status-review";

// Section 2 of a Status Review page — "RAG Status" (renamed from "Focus
// Area Status"), one card per health-declaration category. Inspired by
// design-reference/RAG Status.html's card structure only — no "AI Insight"
// framing; the card body is plainly the category's own declared notes.

// Static Tailwind classes matching HEALTH_LEVELS' dotClass colors — kept as
// an explicit map (not derived via string replace) so the JIT scanner picks
// them up.
const BORDER_CLASS: Record<HealthRating, string> = {
  green: "border-l-emerald-500",
  amber: "border-l-amber-400",
  "potential-red": "border-l-orange-500",
  red: "border-l-red-500",
};

export function RagStatusSection({
  scope,
  scopeId,
  periodId,
}: {
  scope: ReviewScope;
  scopeId: string;
  periodId: string;
}) {
  const { data: declaration } = useReviewHealthDeclaration(scope, scopeId, periodId);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <ShieldAlert className="size-5 text-[#1a6fc4]" />
        RAG Status
      </h2>

      {!declaration ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-center text-sm text-slate-400">
          Not yet declared for this period.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {CATEGORIES.map((category) => {
            const rating = RATING_FROM_API[declaration[category.ratingField]];
            const level = HEALTH_LEVELS.find((l) => l.value === rating)!;
            const description = declaration[category.descriptionField];
            return (
              <article
                key={category.key}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm",
                  BORDER_CLASS[rating]
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{category.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{category.covers}</p>
                  </div>
                  <span className={cn("size-8 shrink-0 rounded-full", level.dotClass)} title={level.label} />
                </div>
                <p className={cn("mt-1 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", level.pillClass)}>
                  {level.label}
                </p>
                <p className="text-sm text-slate-700">{description || "No notes recorded."}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
