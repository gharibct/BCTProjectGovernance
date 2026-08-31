"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { useActions, type ActionLevel } from "@/lib/api/actions";
import { ActionTrackerDrawer } from "./action-tracker-drawer";

// Page-level "Actions" pill (design-reference/Action-Tracker.html's
// dashboard-header trigger, contextTitle='dashboard') — rendered in-flow
// next to the period selector, not a floating action button. Per-section
// triggers from the mockup are out of scope. Scoped by level+id (Geo/
// Account/Project), not by which screen it's rendered on — the same action
// list shows up wherever this is mounted for the same entity.
export function ActionTrackerTrigger({ level, id, name }: { level: ActionLevel; id: string; name: string }) {
  const [open, setOpen] = React.useState(false);
  const { data: actions = [] } = useActions(level, id);
  const overdueCount = actions.filter((a) => a.overdue).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="group flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 shadow-sm transition-colors hover:bg-slate-50"
        >
          <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">Actions</span>
          <span className="rounded-full bg-[#1a6fc4] px-2 py-0.5 text-xs font-bold text-white">{actions.length}</span>
          {overdueCount > 0 ? (
            <span className="flex items-center text-xs font-semibold text-red-600">
              <span className="mr-1 inline-block size-1.5 rounded-full bg-red-600" />
              {overdueCount} Overdue
            </span>
          ) : null}
          <Plus className="size-4 text-slate-400 transition-colors group-hover:text-[#1a6fc4]" />
        </button>
      </SheetTrigger>
      <ActionTrackerDrawer level={level} id={id} name={name} />
    </Sheet>
  );
}
