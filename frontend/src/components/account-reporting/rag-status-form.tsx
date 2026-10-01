"use client";

import * as React from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { HeartPulse, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { currentPeriod } from "@/lib/period-utils";
import { useRegionalDefaultPeriodId } from "@/lib/use-default-period";
import { isReportFrozen } from "@/lib/api/project-status";
import { useRegionalStatusReports } from "@/lib/api/regional-status";
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
import { ACCOUNT_MANAGER_LABEL } from "@/lib/role-labels";

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

export function useAccountHealthDeclarationForm() {
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
  const defaultPeriodId = useRegionalDefaultPeriodId("account", accountId);
  const urlPeriodId = useSearchParams().get("period");
  const periodId = urlPeriodId ?? defaultPeriodId ?? currentPeriod(periods, "Monthly")?.id ?? "";
  const existing = declarations?.find((d) => d.period_id === periodId);

  // RAG Status is filed as part of the Account Status Report package (see
  // regional-reporting/submit-report-action.tsx) — it freezes with it, not
  // with its own (there is no separate "submit" for a RAG declaration).
  const { data: statusReports } = useRegionalStatusReports("account", accountId);
  const statusReport = statusReports?.find((r) => r.period_id === periodId);
  const frozen = statusReport ? isReportFrozen(statusReport.status) : false;

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

  // "Copy from latest report" — seeds the six ratings from the most recent
  // earlier declaration of the same period type. Only when this period has no
  // saved declaration yet; the user still reviews and presses Save Report.
  const copyRatingsFromLatest = (): boolean => {
    if (existing) return false;
    const current = periods.find((p) => p.id === periodId);
    if (!current) return false;
    const source = (declarations ?? [])
      .map((declaration) => ({ declaration, period: periods.find((p) => p.id === declaration.period_id) }))
      .filter(
        ({ period }) => period && period.period_type === current.period_type && period.start_date < current.start_date
      )
      .sort((a, b) => b.period!.start_date.localeCompare(a.period!.start_date))[0];
    if (!source) return false;
    setRatings(fromDeclaration(source.declaration).ratings);
    return true;
  };

  const overall = worstOf(Object.values(ratings));

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  // Persists the six category ratings; throws on failure so callers decide how
  // to report it (Save RAG Status toasts it, the long Delivery Status Report
  // folds it into its single Save Report message).
  const saveRatings = async () => {
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const submit = async () => {
    if (!accountId || !periodId) return;
    try {
      await saveRatings();
      showSuccess("RAG Status Saved Successfully");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save RAG status.");
    }
  };

  return {
    accountId,
    periodId: periodId || null,
    ratings,
    setRating,
    overall,
    submit,
    saveRatings,
    copyRatingsFromLatest,
    frozen,
    isSubmitting: isSubmitting || createDeclaration.isPending || updateDeclaration.isPending,
  };
}

// Project -> Account RAG rollup (pull / ignore / undo) shared by the tabbed
// form and the long Delivery Status Report's RAG block.
export function useAccountHealthRollupProps(accountId: string | null, periodId: string | null) {
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

  return { rollupItems, handlePull, handleIgnore, handleUndo, rollupBusy };
}

function AccountRagStatusFormInner() {
  const form = useAccountHealthDeclarationForm();
  const { accountId, periodId, ratings, setRating, frozen } = form;

  const [tab, setTab] = React.useState<(typeof HEALTH_CATEGORIES)[number]["label"]>(HEALTH_CATEGORIES[0].label);
  const activeTab = HEALTH_CATEGORIES.find((t) => t.label === tab)!;
  const activeCategory = CATEGORIES.find((c) => c.name === activeTab.category)!;

  const rollup = useAccountHealthRollupProps(accountId, periodId);

  if (!accountId) {
    return (
      <EmptyState>No account selected.</EmptyState>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 pb-4 text-lg font-bold text-slate-900">
        <HeartPulse className="size-5 text-slate-700" />
        RAG Status
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
          disabled={frozen}
        />
      </div>

      <div className="mt-6">
        <AccountHealthItemsTab
          accountId={accountId}
          category={activeTab.category}
          title={activeTab.label}
          icon={activeTab.icon}
          frozen={frozen}
          rollupItems={rollup.rollupItems}
          onPullRollupItem={rollup.handlePull}
          onIgnoreRollupItem={rollup.handleIgnore}
          onUndoRollupItem={rollup.handleUndo}
          rollupBusy={rollup.rollupBusy}
        />
      </div>

      <div className="mt-10 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          {frozen
            ? "This account's report has been submitted — RAG Status is now read-only."
            : `Editable by the ${ACCOUNT_MANAGER_LABEL} while the current month is open.`}
        </p>
        {!frozen ? (
          <Button
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={!accountId || form.isSubmitting}
            onClick={form.submit}
          >
            {form.isSubmitting ? <ButtonSpinner /> : null}
            Save RAG Status
          </Button>
        ) : null}
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

// The long Account Delivery Status Report renders RAG as one section instead of
// tabs: every category stacked with its rating picker and notes (+ rollup
// panel), each under an anchor id (rag-<key>) the Report Progress rail uses.
export function AccountHealthSections({
  form,
}: {
  form: ReturnType<typeof useAccountHealthDeclarationForm>;
}) {
  const { accountId, periodId, ratings, setRating, frozen } = form;
  const rollup = useAccountHealthRollupProps(accountId, periodId);

  if (!accountId) {
    return <EmptyState>No account selected.</EmptyState>;
  }

  return (
    <section id="rag" className="scroll-mt-6">
      <div className="flex items-center gap-3 pb-4 text-lg font-bold text-slate-900">
        <HeartPulse className="size-5 text-slate-700" />
        RAG Status
      </div>
      <div className="flex flex-col gap-8">
        {HEALTH_CATEGORIES.map((tab) => {
          const category = CATEGORIES.find((c) => c.name === tab.category)!;
          return (
            <div key={category.key} id={`rag-${category.key}`} className="scroll-mt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">{category.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{category.covers}</p>
                </div>
                <HealthPicker
                  value={ratings[category.key]}
                  onChange={(value) => setRating(category.key, value)}
                  disabled={frozen}
                />
              </div>
              <div className="mt-4">
                <AccountHealthItemsTab
                  accountId={accountId}
                  category={tab.category}
                  title={tab.label}
                  icon={tab.icon}
                  frozen={frozen}
                  rollupItems={rollup.rollupItems}
                  onPullRollupItem={rollup.handlePull}
                  onIgnoreRollupItem={rollup.handleIgnore}
                  onUndoRollupItem={rollup.handleUndo}
                  rollupBusy={rollup.rollupBusy}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
