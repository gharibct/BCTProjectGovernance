"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DeFindingRow } from "@/lib/api/pm-findings";
import { PmFindingsDetailView } from "./pm-findings-detail-view";

export type DrawerState = { findingId: string };

// Right slide-over for PM Findings — detail only (the PM cannot raise
// findings, so there is no create view). Radix unmounts SheetContent on close.
export function PmFindingsDrawer({
  state,
  rows,
  canAct,
  onClose,
}: {
  state: DrawerState | null;
  rows: DeFindingRow[];
  canAct: boolean;
  onClose: () => void;
}) {
  const row = state ? rows.find((r) => r.id === state.findingId) ?? null : null;

  return (
    <Sheet open={state !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent className="gap-0 p-0 sm:w-[480px] lg:w-[38%]">
        <SheetHeader>
          <SheetTitle>{row ? `Finding #${row.sequence_no}` : "Finding"}</SheetTitle>
          <SheetDescription className="sr-only">
            Review a finding and record the action taken.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {row ? (
            <PmFindingsDetailView row={row} canAct={canAct} onClose={onClose} />
          ) : (
            <p className="p-6 text-sm text-slate-400">This finding is no longer in the list.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
