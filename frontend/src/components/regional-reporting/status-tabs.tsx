"use client";

import { StickyActionBar } from "@/components/forms/sticky-action-bar";
import { TrendingUp } from "lucide-react";

import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RegionalScope } from "@/lib/api/regional-status";
import { STATUS_CATEGORIES as TABS } from "@/lib/status-categories";
import { StatusItemsTab } from "./status-items-tab";
import { useRegionalStatusForm } from "./use-regional-status-form";

// Geo's long-page status layout: Key Metrics, then every status category
// expanded one after another (Account has its own long-page layout).

export function StatusTabs({ scope, scopeId }: { scope: RegionalScope; scopeId: string }) {
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

      <div className="mt-8 flex flex-col gap-8">
        {TABS.map((t) => (
          <StatusItemsTab
            key={t.label}
            scope={scope}
            scopeId={scopeId}
            category={t.category}
            title={t.label}
            icon={t.icon}
            frozen={frozen}
            rollupItems={rollupItems}
            onPullRollupItem={handlePull}
            onIgnoreRollupItem={handleIgnore}
            onUndoRollupItem={handleUndo}
            rollupBusy={rollupBusy}
          />
        ))}
      </div>

      {periodId && !frozen ? (
        <StickyActionBar>
          <Button
            className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={isSaving}
            onClick={() => saveDetails()}
          >
            {isSaving ? <ButtonSpinner /> : null}
            Save Details
          </Button>
        </StickyActionBar>
      ) : null}
    </div>
  );
}
