"use client";

import * as React from "react";
import { Download, Layers } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { RollupStatus } from "@/lib/api/account-rollup";

// Scope-agnostic shape both the Project->Account and Account->Geo rollup
// hooks map their raw (differently-shaped) API items into — callers build
// `sourceLabel` themselves (e.g. "PRJ-0001 · Project Name" for the account
// panel, an account's name for the geo panel) so this component never needs
// to know which level it's showing.
export type RollupSourceItem = {
  id: string;
  // The owning project_id (account-scope panel) or account_id (geo-scope
  // panel) — carried through untouched by this component, used by the
  // caller's onIgnore/onUndo handlers to address the right sub-resource.
  sourceEntityId: string;
  sourceLabel: string;
  // A plain string (not a literal union) since this panel is reused for
  // both Project Status rollup (ProjectStatusCategory) and RAG Status
  // rollup (HealthCategory) — it only ever does a `===` comparison against
  // `category` below, so it doesn't need either literal union.
  category: string;
  description: string;
  account_rollup_status: RollupStatus;
};

type RollupSourceHandlers = {
  emptyLabel: string;
  category: string;
  items: RollupSourceItem[];
  onPull: (item: RollupSourceItem) => void;
  onIgnore: (item: RollupSourceItem) => void;
  onUndo: (item: RollupSourceItem) => void;
  busy: boolean;
};

// The category's rollup items with their Pull / Ignore / Undo controls,
// shared by the inline panel (Geo) and the drawer (Account).
function RollupSourceList({ emptyLabel, category, items, onPull, onIgnore, onUndo, busy }: RollupSourceHandlers) {
  const categoryItems = items.filter((item) => item.category === category);

  return categoryItems.length === 0 ? (
    <p className="text-sm text-slate-400">{emptyLabel}</p>
  ) : (
    <div className="flex flex-col gap-3">
      {categoryItems.map((item) => {
        const handled = item.account_rollup_status !== "Pending";
        return (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{item.sourceLabel}</p>
              <p
                className={cn(
                  "mt-1 text-sm text-slate-800",
                  handled && "text-slate-400 line-through decoration-slate-300"
                )}
              >
                {item.description}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.account_rollup_status === "Pending" ? (
                <>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => onIgnore(item)}>
                    Ignore
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => onPull(item)}>
                    Pull
                  </Button>
                </>
              ) : item.account_rollup_status === "Pulled" ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  Added to report
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                    Ignored
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onUndo(item)}
                    className="text-xs font-semibold text-[#1a6fc4] hover:underline disabled:opacity-50"
                  >
                    Undo
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Generic rollup source panel: lists the level-below's own status items for
// the active category/period, letting the reviewer Pull one into their own
// register (below, via StatusItemsTab's EditableTextList) or Ignore it.
// Unlike ai/ai-row-suggestions-panel.tsx (whose Ignored/Applied rows just
// vanish, server-filtered to pending-only), rollup items stay visible in
// place: Pulled/Ignored rows render struck through rather than
// disappearing, since the source item's rollup status is persisted, not
// ephemeral.
export function RollupSourcePanel({ heading, ...list }: RollupSourceHandlers & { heading: string }) {
  const categoryCount = list.items.filter((item) => item.category === list.category).length;

  return (
    <SectionCard icon={Layers} title={heading} aside={<AutoBadge label={`${categoryCount} item(s)`} />}>
      <RollupSourceList {...list} />
    </SectionCard>
  );
}

// Same list, launched on demand from a "Pull from Project" button (placed in
// the register's header, next to the "N logged" badge) as a right-hand drawer
// so the main page stays focused on the report's own items.
export function RollupSourceDrawer({
  heading,
  buttonLabel,
  ...list
}: RollupSourceHandlers & { heading: string; buttonLabel: string }) {
  const [open, setOpen] = React.useState(false);
  const categoryItems = list.items.filter((item) => item.category === list.category);
  const pending = categoryItems.filter((item) => item.account_rollup_status === "Pending").length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Download className="size-3.5" />
          {buttonLabel}
          {pending > 0 ? (
            <span className="rounded-full bg-white px-1.5 text-[10px] font-bold text-primary">{pending}</span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{heading}</SheetTitle>
          <SheetDescription>{categoryItems.length} item(s) for the selected period.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <RollupSourceList {...list} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
