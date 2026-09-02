"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import type { DEAssessmentFinding } from "@/lib/api/de-assessment";
import { FindingsDrawer } from "./findings-drawer";

// "Findings [n]" pill (design-reference/de-assessments/03_..._findings_drawer) —
// mirrors action-tracker-trigger.tsx: an in-flow rounded pill, not a FAB.
export function FindingsDrawerTrigger({
  projectId,
  projectName,
  findings,
}: {
  projectId: string;
  projectName: string;
  findings: DEAssessmentFinding[];
}) {
  const [open, setOpen] = React.useState(false);
  const overdueCount = findings.filter((f) => f.overdue).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="group flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 shadow-sm transition-colors hover:bg-slate-50"
        >
          <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">Findings</span>
          <span className="rounded-full bg-[#1a6fc4] px-2 py-0.5 text-xs font-bold text-white">
            {findings.length}
          </span>
          {overdueCount > 0 ? (
            <span className="flex items-center text-xs font-semibold text-red-600">
              <span className="mr-1 inline-block size-1.5 rounded-full bg-red-600" />
              {overdueCount} Overdue
            </span>
          ) : null}
          <Plus className="size-4 text-slate-400 transition-colors group-hover:text-[#1a6fc4]" />
        </button>
      </SheetTrigger>
      <FindingsDrawer projectId={projectId} projectName={projectName} findings={findings} />
    </Sheet>
  );
}
