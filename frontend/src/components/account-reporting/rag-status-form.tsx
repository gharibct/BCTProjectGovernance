"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { HeartPulse, Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SectionCard, ButtonSpinner } from "@/components/forms/form-primitives";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { currentPeriod } from "@/lib/period-utils";
import {
  useAccountHealthDeclarations,
  useCreateAccountHealthDeclaration,
  useUpdateAccountHealthDeclaration,
  type AccountHealthDeclaration as ApiAccountHealthDeclaration,
  type HealthRating as ApiHealthRating,
} from "@/lib/api/account-health-declarations";
import {
  CATEGORIES,
  DEFAULT_RATINGS,
  EMPTY_DESCRIPTIONS,
  HealthPicker,
  RATING_FROM_API,
  RATING_TO_API,
  worstOf,
  type CategoryKey,
  type HealthRating,
} from "@/components/project-charter/health-declaration";
import { usePageBanner } from "@/stores/page-banner";

// Account RAG Status — account-level equivalent of
// project-charter/health-declaration.tsx's HealthDeclaration/
// useHealthDeclarationForm, minus the Treatment section (Applicable Phase /
// Project Status don't apply to an account). Reuses that file's
// HealthPicker/RATING_TO_API/RATING_FROM_API/CATEGORIES directly — those
// are already generic, only the data-fetching hook needed an account-scoped
// equivalent.

function fromDeclaration(declaration: ApiAccountHealthDeclaration) {
  const ratings = {} as Record<CategoryKey, HealthRating>;
  const descriptions = {} as Record<CategoryKey, string>;
  for (const category of CATEGORIES) {
    ratings[category.key] = RATING_FROM_API[declaration[category.ratingField] as ApiHealthRating];
    descriptions[category.key] = declaration[category.descriptionField] ?? "";
  }
  return { ratings, descriptions };
}

function useAccountHealthDeclarationForm() {
  const { accountId: rawAccountId } = useParams<{ accountId: string }>();
  const accountId = rawAccountId ?? null;
  const { data: periods = [] } = useReportingPeriods();
  const { data: declarations } = useAccountHealthDeclarations(accountId);
  const createDeclaration = useCreateAccountHealthDeclaration(accountId);
  const updateDeclaration = useUpdateAccountHealthDeclaration(accountId);

  // RAG Status is part of both Weekly and Monthly reporting — it follows
  // whichever period is selected (?period=, forwarded by AccountNav same as
  // every other reporting screen), falling back to the current month when
  // reached with no period in the URL (e.g. a direct/bookmarked visit).
  const periodId = useSearchParams().get("period") ?? currentPeriod(periods, "Monthly")?.id ?? "";
  const existing = declarations?.find((d) => d.period_id === periodId);

  const [ratings, setRatings] = React.useState<Record<CategoryKey, HealthRating>>(DEFAULT_RATINGS);
  const [descriptions, setDescriptions] = React.useState<Record<CategoryKey, string>>(EMPTY_DESCRIPTIONS);
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);

  const key = existing ? existing.id : `blank:${periodId}`;
  if (key !== syncedFor) {
    setSyncedFor(key);
    if (existing) {
      const seeded = fromDeclaration(existing);
      setRatings(seeded.ratings);
      setDescriptions(seeded.descriptions);
    } else {
      setRatings(DEFAULT_RATINGS);
      setDescriptions(EMPTY_DESCRIPTIONS);
    }
  }

  const setRating = (categoryKey: CategoryKey, value: HealthRating) =>
    setRatings((prev) => ({ ...prev, [categoryKey]: value }));
  const setDescription = (categoryKey: CategoryKey, value: string) =>
    setDescriptions((prev) => ({ ...prev, [categoryKey]: value }));

  const overall = worstOf(Object.values(ratings));

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const submit = async () => {
    if (!accountId || !periodId) return;
    setIsSubmitting(true);
    try {
      const fields = {
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
      };
      if (existing) {
        await updateDeclaration.mutateAsync({ id: existing.id, payload: fields });
      } else {
        await createDeclaration.mutateAsync({ period_id: periodId, ...fields });
      }
      showSuccess("RAG Status Saved Successfully");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save RAG status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    accountId,
    ratings,
    setRating,
    descriptions,
    setDescription,
    overall,
    submit,
    isSubmitting: isSubmitting || createDeclaration.isPending || updateDeclaration.isPending,
  };
}

function AccountRagStatusFormInner() {
  const form = useAccountHealthDeclarationForm();
  const { ratings, setRating, descriptions, setDescription } = form;

  if (!form.accountId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No account selected.
      </p>
    );
  }

  return (
    <div>
      <SectionCard icon={HeartPulse} title="Delivery Declared Account Health">
        <div className="flex flex-col divide-y divide-slate-100">
          {CATEGORIES.map((category) => (
            <div
              key={category.key}
              className="grid grid-cols-1 items-center gap-4 py-5 first:pt-0 last:pb-0 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,20rem)]"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">{category.name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">{category.covers}</p>
              </div>
              <HealthPicker value={ratings[category.key]} onChange={(value) => setRating(category.key, value)} />
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

      <div className="mt-10 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          Editable by the Account Manager while the current month is open.
        </p>
        <Button
          className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          disabled={!form.accountId || form.isSubmitting}
          onClick={form.submit}
        >
          {form.isSubmitting ? <ButtonSpinner /> : null}
          Save RAG Status
        </Button>
      </div>
    </div>
  );
}

export function AccountRagStatusForm() {
  // useAccountHealthDeclarationForm reads ?period= (useSearchParams), which
  // requires a Suspense boundary at prerender.
  return (
    <React.Suspense fallback={null}>
      <AccountRagStatusFormInner />
    </React.Suspense>
  );
}
