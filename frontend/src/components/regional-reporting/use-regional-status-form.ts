"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { usePageBanner } from "@/stores/page-banner";
import {
  useCreateRegionalStatusReport,
  useRegionalStatusReports,
  useUpdateRegionalStatusReport,
  type RegionalScope,
} from "@/lib/api/regional-status";
import { isReportFrozen } from "@/lib/api/project-status";
import { useAccountRollup, usePullRollupItem, useSetItemRollupStatus } from "@/lib/api/account-rollup";
import { useGeoRollup, usePullGeoRollupItem, useSetAccountItemRollupStatus } from "@/lib/api/geo-rollup";
import type { RollupSourceItem } from "./rollup-source-panel";

// State + save + rollup logic behind the Account/Geo status report, shared by
// the tabbed Geo page (status-tabs.tsx) and the long Account page
// (account-reporting/delivery-status-report.tsx).

const BLANK_METRICS = { revenue: "", onsite_fte: "", offshore_fte: "", projects_count: "" };

export function useRegionalStatusForm(scope: RegionalScope, scopeId: string) {
  const periodId = useSearchParams().get("period");

  const { data: reports } = useRegionalStatusReports(scope, scopeId);
  const createReport = useCreateRegionalStatusReport(scope, scopeId);
  const updateReport = useUpdateRegionalStatusReport(scope, scopeId);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const existing = reports?.find((r) => r.period_id === periodId);
  // Submitted/Approved — the report is frozen (see submit-report-action.tsx);
  // Key Metrics and the status-item registers all stop accepting edits.
  const frozen = existing ? isReportFrozen(existing.status) : false;

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

  // Key Metrics — captured once per report and persisted on "Save Details"
  // rather than immediately like the grid rows. The report is submitted for
  // review separately, from the Dashboard.
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

  // Persists Key Metrics for this period without submitting — the report is
  // only moved Draft -> Submitted from the Dashboard
  // (regional-reporting/submit-report-action.tsx). The status-item registers
  // already persist per-row as they're edited (status-items-tab.tsx), so
  // after this the whole page is saved.
  const saveDetails = async (opts?: { silent?: boolean }): Promise<string | false> => {
    if (!periodId) return false;
    const fields = {
      revenue: metrics.revenue || undefined,
      onsite_fte: metrics.onsite_fte || undefined,
      offshore_fte: metrics.offshore_fte || undefined,
      projects_count: metrics.projects_count ? Number(metrics.projects_count) : undefined,
    };
    try {
      const saved = await (existing
        ? // No status in the payload — a Draft stays Draft, and an already
          // Submitted/Approved report keeps its status.
          updateReport.mutateAsync({ id: existing.id, payload: { ...fields } })
        : createReport.mutateAsync({ period_id: periodId, status: "Draft", ...fields }));
      if (!opts?.silent) showSuccess("Details Saved Successfully");
      return saved.id;
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save details.");
      return false;
    }
  };

  return {
    periodId,
    existing,
    frozen,
    metrics,
    setMetric,
    rollupItems,
    handlePull,
    handleIgnore,
    handleUndo,
    rollupBusy,
    isSaving,
    saveDetails,
  };
}
