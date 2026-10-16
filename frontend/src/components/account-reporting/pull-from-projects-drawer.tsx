"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { ButtonSpinner } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { usePageBanner } from "@/stores/page-banner";
import { RollupSourceList, type PullAllResult, type RollupSourceItem } from "@/components/regional-reporting/rollup-source-panel";
import { HEALTH_CATEGORIES } from "@/lib/health-categories";
import { STATUS_CATEGORIES } from "@/lib/status-categories";

type RollupActions = {
  items: RollupSourceItem[] | undefined;
  onPull: (item: RollupSourceItem) => void;
  onPullAll: (items: RollupSourceItem[]) => Promise<PullAllResult>;
  onIgnore: (item: RollupSourceItem) => void;
  onUndo: (item: RollupSourceItem) => void;
  busy: boolean;
};

// One "Pull from Project" drawer for the whole Account Delivery Status Report,
// replacing the per-section buttons: every Status section and every RAG
// section is listed one below the other, each with the projects' points for the
// selected period and Pull / Ignore at point level. A pulled point shows
// "Added to report"; if the account's copy is later deleted the server reports
// the point as pending again, so Pull / Ignore come back.
export function PullFromProjectsDrawer({
  status,
  health,
  disabled,
}: {
  status: RollupActions;
  health: RollupActions;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [pullingAll, setPullingAll] = React.useState(false);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);
  const all = [...(status.items ?? []), ...(health.items ?? [])];
  const pendingStatus = (status.items ?? []).filter((item) => item.account_rollup_status === "Pending");
  const pendingHealth = (health.items ?? []).filter((item) => item.account_rollup_status === "Pending");
  const pending = pendingStatus.length + pendingHealth.length;

  // Adds every pending point (Status, then RAG) one after another and reports
  // one combined result.
  const pullAll = async () => {
    setPullingAll(true);
    try {
      const a = await status.onPullAll(pendingStatus);
      const b = await health.onPullAll(pendingHealth);
      const pulled = a.pulled + b.pulled;
      const failed = a.failed + b.failed;
      if (failed > 0) {
        showError(`Added ${pulled} point(s); ${failed} failed${a.firstError || b.firstError ? `: ${a.firstError ?? b.firstError}` : "."}`);
      } else {
        showSuccess(`Added ${pulled} point(s) to the report.`);
      }
    } finally {
      setPullingAll(false);
    }
  };

  const group = (
    heading: string,
    sections: { label: string; category: string }[],
    actions: RollupActions
  ) => (
    <section className="flex flex-col gap-5">
      <h3 className="border-b border-slate-200 pb-2 text-base font-bold text-slate-900">{heading}</h3>
      {sections.map((section) => (
        <div key={section.category} className="flex flex-col gap-2">
          <h4 className="text-sm font-bold text-[#1a4a7a]">{section.label}</h4>
          <RollupSourceList
            emptyLabel="Nothing to pull for the selected period."
            category={section.category}
            items={actions.items ?? []}
            onPull={actions.onPull}
            onIgnore={actions.onIgnore}
            onUndo={actions.onUndo}
            busy={actions.busy}
          />
        </div>
      ))}
    </section>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="secondary" className="h-11 gap-2 px-4 text-sm font-semibold" disabled={disabled}>
          <Download className="size-4" />
          Pull from Project
          {pending > 0 ? (
            <span className="rounded-full bg-[#1a6fc4] px-1.5 text-[10px] font-bold text-white">{pending}</span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Rolled Up From Projects</SheetTitle>
          <SheetDescription>
            {all.length} point(s) from your projects for the selected period. Pull the ones you want in this report.
          </SheetDescription>
        </SheetHeader>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-3">
          <p className="text-sm text-slate-500">{pending} point(s) not yet added</p>
          <Button
            size="sm"
            disabled={pending === 0 || pullingAll || status.busy || health.busy}
            onClick={() => void pullAll()}
          >
            {pullingAll ? <ButtonSpinner /> : null}
            Pull All
          </Button>
        </div>
        <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 py-5">
          {group("Status", STATUS_CATEGORIES, status)}
          {group("RAG Status", HEALTH_CATEGORIES, health)}
        </div>
      </SheetContent>
    </Sheet>
  );
}
