"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useNewProjectId } from "@/stores/new-project-ui";
import { usePageBanner } from "@/stores/page-banner";
import { useReportingPeriods } from "@/lib/api/reference-data";
import {
  useCreateStatusReport,
  useStatusReports,
  useUpdateStatusReport,
} from "@/lib/api/project-status";
import { STATUS_CATEGORIES as TABS } from "@/lib/status-categories";
import { StatusItemsTab } from "@/components/project-status/status-items-tab";

// Same 4-category item-grid as project-status/project-status-tabs.tsx (the
// ongoing weekly/monthly reporting screen), reused here so the New Project
// wizard's Project Status step captures the same Key Risks/Issues section
// instead of the old 3-textarea form. Unlike that screen, there's no
// separate "Reporting Hub" page to pick a period from first, so this step
// keeps its own inline period <NativeSelect> — on change it writes ?period=
// into the URL so StatusItemsTab (which reads useSearchParams directly, no
// prop) picks it up without any change to that shared component.
const BLANK_METRICS = { revenue: "", onsite_fte: "", offshore_fte: "", projects_count: "" };

export function NewProjectStatusTabs() {
  const projectId = useNewProjectId();
  const router = useRouter();
  const pathname = usePathname();
  const periodId = useSearchParams().get("period");
  const { data: periods } = useReportingPeriods();

  const [tab, setTab] = React.useState<(typeof TABS)[number]["label"]>(TABS[0].label);
  const active = TABS.find((t) => t.label === tab)!;

  const { data: reports } = useStatusReports(projectId);
  const createReport = useCreateStatusReport(projectId);
  const updateReport = useUpdateStatusReport(projectId);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const existing = reports?.find((r) => r.period_id === periodId);

  const setPeriod = (id: string) => {
    router.replace(id ? `${pathname}?period=${id}` : pathname, { scroll: false });
  };

  // Key Metrics — captured once per report, submitted together with the
  // Draft/Submitted status rather than saved immediately like the grid rows.
  const [metrics, setMetrics] = React.useState(BLANK_METRICS);
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);
  const key = existing ? existing.id : `blank:${periodId}`;
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
        : BLANK_METRICS
    );
  }

  const setMetric = (key: keyof typeof metrics) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setMetrics((prev) => ({ ...prev, [key]: e.target.value }));

  const isSaving = createReport.isPending || updateReport.isPending;

  const save = (status: "Draft" | "Submitted") => {
    if (!projectId || !periodId) return;
    const fields = {
      revenue: metrics.revenue || undefined,
      onsite_fte: metrics.onsite_fte || undefined,
      offshore_fte: metrics.offshore_fte || undefined,
      projects_count: metrics.projects_count ? Number(metrics.projects_count) : undefined,
    };
    const onSuccess = () =>
      showSuccess(status === "Submitted" ? "Status Report Submitted Successfully" : "Draft Saved Successfully");
    const onError = (err: unknown) =>
      showError(err instanceof Error ? err.message : "Failed to save status report.");

    if (existing) {
      updateReport.mutate({ id: existing.id, payload: { ...fields, status } }, { onSuccess, onError });
    } else {
      createReport.mutate({ period_id: periodId, status, ...fields }, { onSuccess, onError });
    }
  };

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  return (
    <div>
      <Field label="Reporting Period" htmlFor="reporting-period" className="w-56">
        <NativeSelect
          id="reporting-period"
          className="h-10 w-56"
          value={periodId ?? ""}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="" disabled>
            Select…
          </option>
          {(periods ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </NativeSelect>
      </Field>

      {periodId ? (
        <div className="mt-6">
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
        <div className="mt-8 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            className="h-11 gap-2 px-6 text-sm font-semibold"
            disabled={isSaving}
            onClick={() => save("Draft")}
          >
            {isSaving ? <ButtonSpinner /> : null}
            Save Draft
          </Button>
          <Button
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={isSaving}
            onClick={() => save("Submitted")}
          >
            {isSaving ? <ButtonSpinner /> : null}
            Submit Report
          </Button>
        </div>
      ) : null}
    </div>
  );
}
