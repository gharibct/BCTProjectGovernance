"use client";

import * as React from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { HeartPulse, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
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
  useAccountHealthRollup,
  usePullHealthRollupItem,
  useSetHealthItemRollupStatus,
} from "@/lib/api/account-health-rollup";
import {
  CATEGORIES,
  DEFAULT_RATINGS,
  HealthPicker,
  RATING_FROM_API,
  RATING_TO_API,
  worstOf,
  type CategoryKey,
  type HealthRating,
} from "@/components/project-charter/health-declaration";
import { HEALTH_CATEGORIES } from "@/lib/health-categories";
import { AccountHealthItemsTab } from "./health-items-tab";
import type { RollupSourceItem } from "@/components/regional-reporting/rollup-source-panel";
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
  for (const category of CATEGORIES) {
    ratings[category.key] = RATING_FROM_API[declaration[category.ratingField] as ApiHealthRating];
  }
  return { ratings };
}

function useAccountHealthDeclarationForm() {
  const { accountId: rawAccountId } = useParams<{ accountId: string }>();
  const accountId = rawAccountId ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const { data: periods = [] } = useReportingPeriods();
  const { data: declarations } = useAccountHealthDeclarations(accountId);
  const createDeclaration = useCreateAccountHealthDeclaration(accountId);
  const updateDeclaration = useUpdateAccountHealthDeclaration(accountId);

  // RAG Status is part of both Weekly and Monthly reporting — it follows
  // whichever period is selected (?period=, forwarded by AccountNav same as
  // every other reporting screen), falling back to the current month when
  // reached with no period in the URL (e.g. a direct/bookmarked visit). The
  // fallback is synced back into the URL below so AccountHealthItemsTab
  // (which reads ?period= directly, same convention as StatusItemsTab)
  // agrees with what the rating section above it is using.
  const urlPeriodId = useSearchParams().get("period");
  const periodId = urlPeriodId ?? currentPeriod(periods, "Monthly")?.id ?? "";
  const existing = declarations?.find((d) => d.period_id === periodId);

  React.useEffect(() => {
    if (!urlPeriodId && periodId) {
      router.replace(`${pathname}?period=${periodId}`, { scroll: false });
    }
  }, [urlPeriodId, periodId, pathname, router]);

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
        people_rating: RATING_TO_API[ratings.people],
        operational_rating: RATING_TO_API[ratings.operational],
        customer_rating: RATING_TO_API[ratings.customer],
        financial_rating: RATING_TO_API[ratings.financial],
        compliance_rating: RATING_TO_API[ratings.compliance],
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
    periodId: periodId || null,
    ratings,
    setRating,
    overall,
    submit,
    isSubmitting: isSubmitting || createDeclaration.isPending || updateDeclaration.isPending,
  };
}

function AccountRagStatusFormInner() {
  const form = useAccountHealthDeclarationForm();
  const { accountId, periodId, ratings, setRating } = form;

  const [tab, setTab] = React.useState<(typeof HEALTH_CATEGORIES)[number]["label"]>(HEALTH_CATEGORIES[0].label);
  const activeTab = HEALTH_CATEGORIES.find((t) => t.label === tab)!;
  const activeCategory = CATEGORIES.find((c) => c.name === activeTab.category)!;

  const { data: healthRollup } = useAccountHealthRollup(accountId, periodId);
  const pullHealthItem = usePullHealthRollupItem(accountId);
  const setHealthItemRollupStatus = useSetHealthItemRollupStatus(accountId);
  const rollupBusy = pullHealthItem.isPending || setHealthItemRollupStatus.isPending;
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const rollupItems: RollupSourceItem[] | undefined = healthRollup?.items.map((item) => ({
    id: item.id,
    sourceEntityId: item.project_id,
    sourceLabel: `${item.project_code} · ${item.project_name}`,
    category: item.category,
    description: item.description,
    account_rollup_status: item.account_rollup_status,
  }));

  const handlePull = (item: RollupSourceItem) => {
    pullHealthItem.mutate(item.id, {
      onSuccess: () => showSuccess(`Pulled into ${item.category}`),
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to pull item."),
    });
  };
  const handleIgnore = (item: RollupSourceItem) => {
    setHealthItemRollupStatus.mutate(
      { projectId: item.sourceEntityId, itemId: item.id, status: "Ignored" },
      { onError: (err) => showError(err instanceof Error ? err.message : "Failed to ignore item.") }
    );
  };
  const handleUndo = (item: RollupSourceItem) => {
    setHealthItemRollupStatus.mutate(
      { projectId: item.sourceEntityId, itemId: item.id, status: "Pending" },
      { onError: (err) => showError(err instanceof Error ? err.message : "Failed to undo.") }
    );
  };

  if (!accountId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No account selected.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 pb-4 text-lg font-bold text-slate-900">
        <HeartPulse className="size-5 text-slate-700" />
        Delivery Declared Account Health
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
        <HealthPicker value={ratings[activeCategory.key]} onChange={(value) => setRating(activeCategory.key, value)} />
      </div>

      <div className="mt-6">
        <AccountHealthItemsTab
          accountId={accountId}
          category={activeTab.category}
          title={activeTab.label}
          icon={activeTab.icon}
          rollupItems={rollupItems}
          onPullRollupItem={handlePull}
          onIgnoreRollupItem={handleIgnore}
          onUndoRollupItem={handleUndo}
          rollupBusy={rollupBusy}
        />
      </div>

      <div className="mt-10 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          Editable by the Account Manager while the current month is open.
        </p>
        <Button
          className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          disabled={!accountId || form.isSubmitting}
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
