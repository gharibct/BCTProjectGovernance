"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageBanner } from "@/stores/page-banner";
import {
  useCreateRegionalStatusReport,
  useRegionalStatusReports,
  useUpdateRegionalStatusReport,
  type RegionalScope,
} from "@/lib/api/regional-status";
import { useAccountRollup, usePullRollupItem, useSetItemRollupStatus } from "@/lib/api/account-rollup";
import { useGeoRollup, usePullGeoRollupItem, useSetAccountItemRollupStatus } from "@/lib/api/geo-rollup";
import { STATUS_CATEGORIES as TABS } from "@/lib/status-categories";
import { StatusItemsTab } from "./status-items-tab";
import type { RollupSourceItem } from "./rollup-source-panel";

// Mirrors components/project-status/project-status-tabs.tsx exactly,
// generalized by scope ("account" | "geo").

const BLANK_METRICS = { revenue: "", onsite_fte: "", offshore_fte: "", projects_count: "" };

export function StatusTabs({ scope, scopeId }: { scope: RegionalScope; scopeId: string }) {
  const periodId = useSearchParams().get("period");
  const [tab, setTab] = React.useState<(typeof TABS)[number]["label"]>(TABS[0].label);
  const active = TABS.find((t) => t.label === tab)!;

  const { data: reports } = useRegionalStatusReports(scope, scopeId);
  const createReport = useCreateRegionalStatusReport(scope, scopeId);
  const updateReport = useUpdateRegionalStatusReport(scope, scopeId);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const existing = reports?.find((r) => r.period_id === periodId);

  // Rollup, one level below this scope: Project->Account for "account",
  // Account->Geo for "geo" — pre-fills Key Metrics and feeds each category
  // tab's source panel. Only one of the two hooks is ever enabled at a time
  // (the other's id is null), so exactly one of accountRollup/geoRollup is
  // ever populated for a given render.
  const rollupAccountId = scope === "account" ? scopeId : null;
  const rollupGeoId = scope === "geo" ? scopeId : null;
  const { data: accountRollup } = useAccountRollup(rollupAccountId, periodId);
  const { data: geoRollup } = useGeoRollup(rollupGeoId, periodId);
  const pullAccountItem = usePullRollupItem(rollupAccountId);
  const pullGeoItem = usePullGeoRollupItem(rollupGeoId);
  const setAccountItemRollupStatus = useSetItemRollupStatus(rollupAccountId);
  const setGeoItemRollupStatus = useSetAccountItemRollupStatus(rollupGeoId);
  const rollupBusy =
    pullAccountItem.isPending ||
    pullGeoItem.isPending ||
    setAccountItemRollupStatus.isPending ||
    setGeoItemRollupStatus.isPending;

  const rollupMetrics = scope === "account" ? accountRollup?.metrics : scope === "geo" ? geoRollup?.metrics : undefined;

  const rollupItems: RollupSourceItem[] | undefined =
    scope === "account"
      ? accountRollup?.items.map((item) => ({
          id: item.id,
          sourceEntityId: item.project_id,
          sourceLabel: `${item.project_code} · ${item.project_name}`,
          category: item.category,
          description: item.description,
          account_rollup_status: item.account_rollup_status,
        }))
      : scope === "geo"
        ? geoRollup?.items.map((item) => ({
            id: item.id,
            sourceEntityId: item.account_id,
            sourceLabel: item.account_name,
            category: item.category,
            description: item.description,
            account_rollup_status: item.account_rollup_status,
          }))
        : undefined;

  // Key Metrics — captured once per report, submitted together with the
  // Draft/Submitted status rather than saved immediately like the grid rows.
  const [metrics, setMetrics] = React.useState(BLANK_METRICS);
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);
  // Once there's no existing report, wait for the rollup to load before
  // syncing — `key` changes again when it arrives, re-triggering the sync
  // below with the rolled-up values instead of blank.
  const key = existing ? existing.id : rollupMetrics ? `rollup:${periodId}` : `blank:${periodId}`;
  if (key !== syncedFor) {
    setSyncedFor(key);
    setMetrics(
      existing
        ? {
            revenue: existing.revenue ?? "",
            onsite_fte: existing.onsite_fte ?? "",
            offshore_fte: existing.offshore_fte ?? "",
            projects_count: existing.projects_count?.toString() ?? "",
          }
        : rollupMetrics
          ? {
              revenue: rollupMetrics.revenue ?? "",
              onsite_fte: rollupMetrics.onsite_fte ?? "",
              offshore_fte: rollupMetrics.offshore_fte ?? "",
              projects_count: rollupMetrics.projects_count?.toString() ?? "",
            }
          : BLANK_METRICS
    );
  }

  const setMetric = (key: keyof typeof metrics) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setMetrics((prev) => ({ ...prev, [key]: e.target.value }));

  const handlePull = (item: RollupSourceItem) => {
    const onSuccess = () => showSuccess(`Pulled into ${item.category}`);
    const onError = (err: unknown) => showError(err instanceof Error ? err.message : "Failed to pull item.");
    if (scope === "account") pullAccountItem.mutate(item.id, { onSuccess, onError });
    else if (scope === "geo") pullGeoItem.mutate(item.id, { onSuccess, onError });
  };

  const handleIgnore = (item: RollupSourceItem) => {
    const onError = (err: unknown) => showError(err instanceof Error ? err.message : "Failed to ignore item.");
    if (scope === "account") {
      setAccountItemRollupStatus.mutate(
        { projectId: item.sourceEntityId, itemId: item.id, status: "Ignored" },
        { onError }
      );
    } else if (scope === "geo") {
      setGeoItemRollupStatus.mutate({ accountId: item.sourceEntityId, itemId: item.id, status: "Ignored" }, { onError });
    }
  };

  const handleUndo = (item: RollupSourceItem) => {
    const onError = (err: unknown) => showError(err instanceof Error ? err.message : "Failed to undo.");
    if (scope === "account") {
      setAccountItemRollupStatus.mutate(
        { projectId: item.sourceEntityId, itemId: item.id, status: "Pending" },
        { onError }
      );
    } else if (scope === "geo") {
      setGeoItemRollupStatus.mutate({ accountId: item.sourceEntityId, itemId: item.id, status: "Pending" }, { onError });
    }
  };

  const isSaving = createReport.isPending || updateReport.isPending;

  const submitReport = () => {
    if (!periodId) return;
    const fields = {
      revenue: metrics.revenue || undefined,
      onsite_fte: metrics.onsite_fte || undefined,
      offshore_fte: metrics.offshore_fte || undefined,
      projects_count: metrics.projects_count ? Number(metrics.projects_count) : undefined,
    };
    const onSuccess = () => showSuccess("Status Report Submitted Successfully");
    const onError = (err: unknown) =>
      showError(err instanceof Error ? err.message : "Failed to submit status report.");

    if (existing) {
      updateReport.mutate({ id: existing.id, payload: { ...fields, status: "Submitted" } }, { onSuccess, onError });
    } else {
      createReport.mutate({ period_id: periodId, status: "Submitted", ...fields }, { onSuccess, onError });
    }
  };

  return (
    <div>
      {periodId ? (
        <SectionCard icon={TrendingUp} title="Key Metrics">
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
            <Field label="Revenue" htmlFor="revenue">
              <Input
                id="revenue"
                type="number"
                className="h-11"
                value={metrics.revenue}
                onChange={setMetric("revenue")}
              />
            </Field>
            <Field label="Onsite FTE" htmlFor="onsite_fte">
              <Input
                id="onsite_fte"
                type="number"
                className="h-11"
                value={metrics.onsite_fte}
                onChange={setMetric("onsite_fte")}
              />
            </Field>
            <Field label="Offshore FTE" htmlFor="offshore_fte">
              <Input
                id="offshore_fte"
                type="number"
                className="h-11"
                value={metrics.offshore_fte}
                onChange={setMetric("offshore_fte")}
              />
            </Field>
            <Field label="Projects Count" htmlFor="projects_count">
              <Input
                id="projects_count"
                type="number"
                className="h-11"
                value={metrics.projects_count}
                onChange={setMetric("projects_count")}
              />
            </Field>
          </div>
        </SectionCard>
      ) : null}

      <div role="tablist" className="mt-8 flex gap-8 border-b border-slate-200">
        {TABS.map((t) => (
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

      <div className="mt-8">
        <StatusItemsTab
          scope={scope}
          scopeId={scopeId}
          category={active.category}
          title={active.label}
          icon={active.icon}
          rollupItems={rollupItems}
          onPullRollupItem={handlePull}
          onIgnoreRollupItem={handleIgnore}
          onUndoRollupItem={handleUndo}
          rollupBusy={rollupBusy}
        />
      </div>

      {periodId ? (
        <div className="mt-8 flex justify-end">
          <Button
            className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={isSaving}
            onClick={submitReport}
          >
            {isSaving ? <ButtonSpinner /> : null}
            Submit Report
          </Button>
        </div>
      ) : null}
    </div>
  );
}
