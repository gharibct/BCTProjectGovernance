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
  assessmentId,
  projectName,
  findings,
}: {
  projectId: string;
  assessmentId: string | null;
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
        {view === "list" ? (
          <FindingsListView
            findings={findings}
            assessmentId={assessmentId}
            onSelect={(id) => {
              setSelectedId(id);
              setView("detail");
            }}
            onCreate={() => setView("create")}
          />
        ) : view === "detail" && selected ? (
          <FindingsDetailView
            projectId={projectId}
            assessmentId={assessmentId}
            finding={selected}
            onBack={() => setView("list")}
          />
        ) : view === "create" && assessmentId ? (
          <FindingsCreateView
            projectId={projectId}
            assessmentId={assessmentId}
            onDone={() => setView("list")}
          />
        ) : (
          <FindingsListView
            findings={findings}
            assessmentId={assessmentId}
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
