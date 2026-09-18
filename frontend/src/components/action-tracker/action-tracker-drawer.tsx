"use client";

import * as React from "react";

import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ActionLevel } from "@/lib/api/actions";
import { ActionCreateView } from "./action-create-view";
import { ActionDetailView } from "./action-detail-view";
import { ActionListView } from "./action-list-view";

type View = "list" | "detail" | "create";

// Three views in one drawer (design-reference/Action-Tracker.html's
// switchDrawerView), not three separate modals. This component is an
// unconditional child of <Sheet> (see ActionTrackerTrigger) — only
// SheetContent's own Presence mounts/unmounts on `open`, so this component
// instance (and its view/selectedId state) survives every close. The effect
// below resets it explicitly so each reopen starts back at the list.
export function ActionTrackerDrawer({
  level,
  id,
  name,
  open,
}: {
  level: ActionLevel;
  id: string;
  name: string;
  open: boolean;
}) {
  const [view, setView] = React.useState<View>("list");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setView("list");
      setSelectedId(null);
    }
  }, [open]);

  return (
    <SheetContent className="gap-0 p-0">
      <SheetHeader>
        <SheetTitle>{view === "create" ? "New Action" : `Actions — ${name}`}</SheetTitle>
        <SheetDescription className="sr-only">Screen-level action tracker for this {name}.</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto">
        {view === "list" ? (
          <ActionListView
            level={level}
            id={id}
            onSelect={(actionId) => {
              setSelectedId(actionId);
              setView("detail");
            }}
            onCreate={() => setView("create")}
          />
        ) : view === "detail" && selectedId ? (
          <ActionDetailView level={level} id={id} actionId={selectedId} onBack={() => setView("list")} />
        ) : view === "create" ? (
          <ActionCreateView level={level} id={id} name={name} onDone={() => setView("list")} />
        ) : null}
      </div>
    </SheetContent>
  );
}
