"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { RiskLog } from "./risk-log";
import { AssumptionLog } from "./assumption-log";
import { IssueLog } from "./issue-log";
import { DependencyLog } from "./dependency-log";
import { OpportunityLog } from "./opportunity-log";

// Tab order follows the RAIDO acronym: Risk, Assumption, Issue, Dependency,
// Opportunity (§4.5–4.9). Items in each log are created/edited ad hoc —
// there's no periodic submit for this screen, unlike Measurement/Status.
const TABS = [
  { label: "Risk", content: RiskLog },
  { label: "Assumption", content: AssumptionLog },
  { label: "Issue", content: IssueLog },
  { label: "Dependency", content: DependencyLog },
  { label: "Opportunity", content: OpportunityLog },
] as const;

export function RaidoTabs() {
  const [tab, setTab] = React.useState<(typeof TABS)[number]["label"]>("Risk");
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
    </div>
  );
}
