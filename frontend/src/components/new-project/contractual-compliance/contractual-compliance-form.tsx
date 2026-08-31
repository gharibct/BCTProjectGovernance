"use client";

import * as React from "react";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

import { CommitmentsTab } from "./commitments-tab";
import { MilestonesTab } from "./milestones-tab";

// Short tab names, matching the RAIDO Register page's tab pattern: register
// grid on top, "New <Item>" entry form second.
const TABS = [
  { label: "Commitments", content: CommitmentsTab },
  { label: "Payment Milestones", content: MilestonesTab },
] as const;

export function ContractualComplianceForm() {
  const [tab, setTab] = React.useState<(typeof TABS)[number]["label"]>(
    "Commitments"
  );
  const Active = TABS.find((t) => t.label === tab)!.content;

  return (
    <div>
      <div role="tablist" className="flex gap-8 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={tab === t.label}
            onClick={() => setTab(t.label)}
            className={cn(
              "-mb-px border-b-2 pb-3 text-sm font-semibold whitespace-nowrap transition-colors",
              tab === t.label
                ? "border-[#1a4a7a] text-[#1a4a7a]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <Active />
      </div>

      <div className="mt-10 flex flex-wrap items-start justify-between gap-4">
        <p className="flex max-w-2xl items-start gap-2 text-sm text-slate-500">
          <Lock className="mt-0.5 size-4 shrink-0" />
          Each entry saves immediately when added — Commitments and
          Payment Milestones are logged independently, row by row.
        </p>
      </div>
    </div>
  );
}
