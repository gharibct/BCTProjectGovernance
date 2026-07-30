"use client";

import { cn } from "@/lib/utils";
import { projectCount, type ProjectFilter } from "./data";

// The PM's four morning-triage questions, in reading order: how many projects
// am I running, which are burning, which are about to burn, who hasn't
// reported. Each card filters the grid below.
const CARDS: {
  filter: ProjectFilter;
  label: string;
  hint: string;
  accent?: string;
  valueClass?: string;
}[] = [
  {
    filter: "all",
    label: "Active Projects",
    hint: "Across all accounts",
  },
  {
    filter: "red",
    label: "Red Projects",
    hint: "Need intervention now",
    accent: "border-l-red-600",
    valueClass: "text-red-600",
  },
  {
    filter: "potential-red",
    label: "Potential Red",
    hint: "Trending toward red",
    accent: "border-l-orange-500",
    valueClass: "text-orange-600",
  },
  {
    filter: "status-pending",
    label: "Status Pending",
    hint: "Weekly report overdue",
    accent: "border-l-amber-400",
    valueClass: "text-slate-900",
  },
];

export function KpiCards({
  selected,
  onSelect,
}: {
  selected: ProjectFilter;
  onSelect: (filter: ProjectFilter) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {CARDS.map((card) => {
        const active = card.filter === selected;
        return (
          <button
            key={card.filter}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(card.filter)}
            className={cn(
              "rounded-xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition-all hover:shadow-md",
              card.accent && cn("border-l-4", card.accent),
              active && "ring-2 ring-[#1a6fc4] ring-offset-1"
            )}
          >
            <div className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              {card.label}
            </div>
            <div
              className={cn(
                "mt-1 text-3xl font-bold text-slate-900",
                card.valueClass
              )}
            >
              {projectCount(card.filter)}
            </div>
            <div className="mt-1 text-sm text-slate-400">{card.hint}</div>
          </button>
        );
      })}
    </div>
  );
}
