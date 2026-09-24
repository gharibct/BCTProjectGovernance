"use client";

import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

// Account Reporting hub's "Customer Communications" card — sits beside the
// Delivery Status card (progress-ring-card.tsx), so it copies that card's
// chrome and its 32-unit ring: the total communications shared in the ring,
// This Year / This Quarter / This Month counts where the legend is, the last
// communication underneath, and an Add Communication action.

// Same geometry as the donut in ReportingProgressCard.
const R = 42;
const STROKE = 14;

export type CustomerCommunicationCounts = {
  total: number;
  thisYear: number;
  thisQuarter: number;
  thisMonth: number;
};

export type LastCustomerCommunication = {
  // Display-ready date (e.g. "18-Sep-2026").
  date: string;
  title: string;
};

export function CustomerCommunicationsCard({
  counts,
  last,
  addHref,
}: {
  counts: CustomerCommunicationCounts;
  last: LastCustomerCommunication | null;
  // The Customer Communications (Account) page, where one is added.
  addHref: string;
}) {
  const breakdown = [
    { label: "This Year", count: counts.thisYear },
    { label: "This Quarter", count: counts.thisQuarter },
    { label: "This Month", count: counts.thisMonth },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold tracking-wide text-slate-500 uppercase">Customer Communications</h3>
        <MessageSquare className="size-5 text-[#1a6fc4]" />
      </div>

      <div className="flex items-center gap-5">
        <div className="relative size-32 shrink-0">
          <svg viewBox="0 0 120 120" className="size-full">
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={counts.total > 0 ? "#10b981" : "#e2e8f0"}
              strokeWidth={STROKE}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-slate-900">{counts.total}</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">Communications Shared</div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {breakdown.map((row) => (
              <li key={row.label} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="inline-block size-2.5 rounded-full bg-emerald-500" />
                  {row.label}
                </span>
                <span className="font-semibold text-slate-900">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Same height/border as the period combo on the Delivery Status card,
            so the two cards (and the boxes beneath them) line up. */}
        <div className="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 text-sm">
          <span className="shrink-0 text-slate-500">Last Shared:</span>
          <span className="shrink-0 font-semibold text-slate-900">{last?.date ?? "—"}</span>
          {last ? <span className="truncate text-slate-700">· {last.title}</span> : null}
        </div>
        <Button
          asChild
          className="h-10 shrink-0 gap-2 bg-[#1a4a7a] px-4 text-sm font-semibold text-white hover:bg-[#15406b]"
        >
          <Link href={addHref}>
            <Plus className="size-4" />
            Add Communication
          </Link>
        </Button>
      </div>
    </div>
  );
}
