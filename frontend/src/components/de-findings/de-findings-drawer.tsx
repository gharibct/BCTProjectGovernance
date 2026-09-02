"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DeFindingRow } from "@/lib/api/de-findings";
import { DeFindingsCreateView } from "./de-findings-create-view";
import { DeFindingsDetailView } from "./de-findings-detail-view";

export type DrawerState = { mode: "create" | "detail"; findingId?: string };

// Right slide-over for DE Findings. Two views (the main page is the list):
// "create" (New Finding, project chosen in-drawer) and "detail" (a row seeded
// from the grid). Radix unmounts SheetContent on close, so view state resets.
export function DeFindingsDrawer({
  state,
  rows,
  canWrite,
  onClose,
}: {
  state: DrawerState | null;
  rows: DeFindingRow[];
  canWrite: boolean;
  onClose: () => void;
}) {
  const row = state?.mode === "detail" ? rows.find((r) => r.id === state.findingId) ?? null : null;

  return (
    <Sheet open={state !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent className="gap-0 p-0 sm:w-[480px] lg:w-[38%]">
        <SheetHeader>
          <SheetTitle>
            {state?.mode === "detail" && row ? `Finding #${row.sequence_no}` : "New Finding"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Create a finding or review and update an existing one.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {state?.mode === "detail" ? (
            row ? (
              <DeFindingsDetailView row={row} canWrite={canWrite} onClose={onClose} />
            ) : (
              <p className="p-6 text-sm text-slate-400">This finding is no longer in the list.</p>
            )
          ) : (
            <DeFindingsCreateView onDone={onClose} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
