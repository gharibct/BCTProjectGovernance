"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageBanner } from "@/stores/page-banner";
import { useReportingPeriods } from "@/lib/api/reference-data";
import {
  previousPeriodReport,
  statusMetricsFromReport,
  useCreateStatusReport,
  useStatusReports,
  useUpdateStatusReport,
} from "@/lib/api/project-status";
import { STATUS_CATEGORIES as TABS } from "@/lib/status-categories";
import { StatusItemsTab } from "./status-items-tab";

// Same plain client-state tab bar as raido/raido-tabs.tsx — no route/query-param sync.

const BLANK_METRICS = { revenue: "", onsite_fte: "", offshore_fte: "", projects_count: "" };

export function ProjectStatusTabs() {
  const { projectId } = useParams<{ projectId: string }>();
  const periodId = useSearchParams().get("period");
  const [tab, setTab] = React.useState<(typeof TABS)[number]["label"]>(TABS[0].label);
  const active = TABS.find((t) => t.label === tab)!;

  const { data: reports } = useStatusReports(projectId ?? null);
  const { data: periods = [] } = useReportingPeriods();
  const createReport = useCreateStatusReport(projectId ?? null);
  const updateReport = useUpdateStatusReport(projectId ?? null);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const existing = reports?.find((r) => r.period_id === periodId);

  // No report yet for this period → carry Key Metrics forward from the last
  // period's report so unchanged figures don't have to be re-keyed.
  const carriedFrom = existing ? undefined : previousPeriodReport(reports, periods, periodId);
  const carriedFromLabel = carriedFrom
    ? periods.find((p) => p.id === carriedFrom.period_id)?.label
    : null;

  // Key Metrics — captured once per report and persisted on "Save Details"
  // rather than immediately like the grid rows. The report is submitted for
  // review separately, from the Dashboard.
  const [metrics, setMetrics] = React.useState(BLANK_METRICS);
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);
  const key = existing ? existing.id : `blank:${carriedFrom?.id ?? "none"}:${periodId}`;
  if (key !== syncedFor) {
    setSyncedFor(key);
    setMetrics(
      existing
        ? statusMetricsFromReport(existing)
        : carriedFrom
          ? statusMetricsFromReport(carriedFrom)
          : BLANK_METRICS
    );
  }

  const setMetric = (key: keyof typeof metrics) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setMetrics((prev) => ({ ...prev, [key]: e.target.value }));

  const isSaving = createReport.isPending || updateReport.isPending;

  // Persists Key Metrics for this period without submitting — the report is
  // only moved Draft -> Submitted from the Dashboard
  // (project-dashboard/submit-report-action.tsx). Key Accomplishments and the
  // other status-item registers already persist per-row as they're edited
  // (status-items-tab.tsx), so after this the whole page is saved.
  const saveDetails = async () => {
    if (!periodId) return;
    const fields = {
      revenue: metrics.revenue || undefined,
      onsite_fte: metrics.onsite_fte || undefined,
      offshore_fte: metrics.offshore_fte || undefined,
      projects_count: metrics.projects_count ? Number(metrics.projects_count) : undefined,
    };
    try {
      await (existing
        ? // No status in the payload — a Draft stays Draft, and an already
          // Submitted/Approved report keeps its status.
          updateReport.mutateAsync({ id: existing.id, payload: { ...fields } })
        : createReport.mutateAsync({ period_id: periodId, status: "Draft", ...fields }));
      showSuccess("Details Saved Successfully");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save details.");
    }
  };

  return (
    <div>
      {periodId ? (
        <div className="flex flex-col gap-8">
          <SectionCard icon={TrendingUp} title="Key Metrics">
            {carriedFromLabel ? (
              <p className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Pre-filled from {carriedFromLabel}. Review and adjust before saving.
              </p>
            ) : null}
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
        </div>
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
        <StatusItemsTab category={active.category} title={active.label} icon={active.icon} />
      </div>

      {periodId ? (
        <div className="mt-8 flex justify-end">
          <Button
            className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={isSaving}
            onClick={saveDetails}
          >
            {isSaving ? <ButtonSpinner /> : null}
            Save Details
          </Button>
        </div>
      ) : null}
    </div>
  );
}
