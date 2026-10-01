"use client";

import * as React from "react";
import { TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RegionalScope } from "@/lib/api/regional-status";
import { STATUS_CATEGORIES as TABS } from "@/lib/status-categories";
import { StatusItemsTab } from "./status-items-tab";
import { useRegionalStatusForm } from "./use-regional-status-form";

// Mirrors the old tabbed project status page, generalized by scope. Geo still
// uses this tabbed layout; Account has the long-page layout instead.

export function StatusTabs({ scope, scopeId }: { scope: RegionalScope; scopeId: string }) {
  const [tab, setTab] = React.useState<(typeof TABS)[number]["label"]>(TABS[0].label);
  const active = TABS.find((t) => t.label === tab)!;
  const {
    periodId,
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
  } = useRegionalStatusForm(scope, scopeId);

  return (
    <div>
      {periodId ? (
        <SectionCard icon={TrendingUp} title="Key Metrics">
          {frozen ? (
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This report has been submitted and is now read-only.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
            <Field label="Revenue (USD)" htmlFor="revenue">
              <Input
                id="revenue"
                type="number"
                className="h-11"
                value={metrics.revenue}
                onChange={setMetric("revenue")}
                disabled={frozen}
              />
            </Field>
            <Field label="Onsite FTE" htmlFor="onsite_fte">
              <Input
                id="onsite_fte"
                type="number"
                className="h-11"
                value={metrics.onsite_fte}
                onChange={setMetric("onsite_fte")}
                disabled={frozen}
              />
            </Field>
            <Field label="Offshore FTE" htmlFor="offshore_fte">
              <Input
                id="offshore_fte"
                type="number"
                className="h-11"
                value={metrics.offshore_fte}
                onChange={setMetric("offshore_fte")}
                disabled={frozen}
              />
            </Field>
            <Field label="Projects Count" htmlFor="projects_count">
              <Input
                id="projects_count"
                type="number"
                className="h-11"
                value={metrics.projects_count}
                onChange={setMetric("projects_count")}
                disabled={frozen}
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
          frozen={frozen}
          rollupItems={rollupItems}
          onPullRollupItem={handlePull}
          onIgnoreRollupItem={handleIgnore}
          onUndoRollupItem={handleUndo}
          rollupBusy={rollupBusy}
        />
      </div>

      {periodId && !frozen ? (
        <div className="mt-8 flex justify-end">
          <Button
            className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={isSaving}
            onClick={() => saveDetails()}
          >
            {isSaving ? <ButtonSpinner /> : null}
            Save Details
          </Button>
        </div>
      ) : null}
    </div>
  );
}
