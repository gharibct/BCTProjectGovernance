"use client";

import * as React from "react";

import { SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DEAssessmentFinding } from "@/lib/api/de-assessment";
import { FindingsListView } from "./findings-list-view";
import { FindingsDetailView } from "./findings-detail-view";
import { FindingsCreateView } from "./findings-create-view";

type View = "list" | "detail" | "create";

// Three views in one drawer, mirroring action-tracker-drawer.tsx. Radix
// unmounts SheetContent on close, so view/selectedId reset for free.
export function FindingsDrawer({
  projectId,
  projectName,
  findings,
}: {
  projectId: string;
  projectName: string;
  findings: DEAssessmentFinding[];
}) {
  const [view, setView] = React.useState<View>("list");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const selected = selectedId ? findings.find((f) => f.id === selectedId) ?? null : null;

  return (
    <SheetContent className="gap-0 p-0 sm:w-[540px] lg:w-[40%]">
      <SheetHeader>
        <SheetTitle>
          {view === "create" ? `New Finding — ${projectName}` : `Findings — ${projectName}`}
        </SheetTitle>
        <SheetDescription className="sr-only">
          Manage and track findings for this project assessment.
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto">
        {view === "detail" && selected ? (
          <FindingsDetailView
            projectId={projectId}
            finding={selected}
            onBack={() => setView("list")}
          />
        ) : view === "create" ? (
          <FindingsCreateView projectId={projectId} onDone={() => setView("list")} />
        ) : (
          <FindingsListView
            findings={findings}
            onSelect={(id) => {
              setSelectedId(id);
              setView("detail");
            }}
            onCreate={() => setView("create")}
          />
        )}
      </div>
    </SheetContent>
  );
}
