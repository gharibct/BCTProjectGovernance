"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AlertTriangle, Rocket, TrendingUp, Trophy, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageBanner } from "@/stores/page-banner";
import {
  useCreateStatusReport,
  useStatusReports,
  useUpdateStatusReport,
} from "@/lib/api/project-status";
import { StatusItemsTab } from "./status-items-tab";

// Tab order matches the original 3 free-text sections, plus the new 4th
// "Key Risks / Issues" section. Same plain client-state tab bar as
// raido/raido-tabs.tsx — no route/query-param sync.
const TABS = [
  { label: "Key Accomplishments", category: "Key Accomplishments" as const, icon: Trophy },
  {
    label: "Upcoming Releases",
    category: "Upcoming Key Releases / Milestones / Actions" as const,
    icon: Rocket,
  },
  {
    label: "Leadership Support",
    category: "Leadership Support / Attention Required" as const,
    icon: Users,
  },
  { label: "Key Risks / Issues", category: "Key Risks / Issues" as const, icon: AlertTriangle },
] as const;

const BLANK_METRICS = { revenue: "", onsite_fte: "", offshore_fte: "", projects_count: "" };

export function ProjectStatusTabs() {
  const { projectId } = useParams<{ projectId: string }>();
  const periodId = useSearchParams().get("period");
  const [tab, setTab] = React.useState<(typeof TABS)[number]["label"]>(TABS[0].label);
  const active = TABS.find((t) => t.label === tab)!;

  const { data: reports } = useStatusReports(projectId ?? null);
  const createReport = useCreateStatusReport(projectId ?? null);
  const updateReport = useUpdateStatusReport(projectId ?? null);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const existing = reports?.find((r) => r.period_id === periodId);

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
        <StatusItemsTab category={active.category} title={active.label} icon={active.icon} />
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
