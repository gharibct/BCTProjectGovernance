"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  { key: "risk", label: "Risk", content: RiskLog },
  { key: "assumption", label: "Assumption", content: AssumptionLog },
  { key: "issue", label: "Issue", content: IssueLog },
  { key: "dependency", label: "Dependency", content: DependencyLog },
  { key: "opportunity", label: "Opportunity", content: OpportunityLog },
] as const;

// The active tab lives in the URL (?tab=risk|assumption|...) so the right-hand
// Project Performance menu can deep-link to a log and stay in sync with the
// tab strip — picking a tab here rewrites the URL, and the menu reads it.
export function RaidoTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = TABS.find((t) => t.key === searchParams.get("tab"))?.label ?? "Risk";
  const Active = TABS.find((t) => t.label === tab)!.content;

  const selectTab = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-2 border-b-2 border-[#1a6fc4]">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={tab === t.label}
            onClick={() => selectTab(t.key)}
            className={cn(
              "-mb-0.5 rounded-t-lg border-2 border-b-0 px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-colors",
              tab === t.label
                ? "border-[#1a4a7a] bg-[#1a4a7a] text-white"
                : "border-[#1a6fc4] bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-[#1a4a7a]"
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
