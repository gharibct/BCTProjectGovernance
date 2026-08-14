"use client";

import { Layers } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
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

// Generic rollup source panel: lists the level-below's own status items for
// the active category/period, letting the reviewer Pull one into their own
// register (below, via StatusItemsTab's EditableTextList) or Ignore it.
// Unlike ai/ai-row-suggestions-panel.tsx (whose Ignored/Applied rows just
// vanish, server-filtered to pending-only), rollup items stay visible in
// place — Pulled/Ignored rows render struck through rather than
// disappearing, since the source item's rollup status is persisted, not
// ephemeral.
export function RollupSourcePanel({
  heading,
  emptyLabel,
  category,
  items,
  onPull,
  onIgnore,
  onUndo,
  busy,
}: {
  heading: string;
  emptyLabel: string;
  category: string;
  items: RollupSourceItem[];
  onPull: (item: RollupSourceItem) => void;
  onIgnore: (item: RollupSourceItem) => void;
  onUndo: (item: RollupSourceItem) => void;
  busy: boolean;
}) {
  const categoryItems = items.filter((item) => item.category === category);

  return (
    <SectionCard icon={Layers} title={heading} aside={<AutoBadge label={`${categoryItems.length} item(s)`} />}>
      {categoryItems.length === 0 ? (
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
      )}
    </SectionCard>
  );
}
