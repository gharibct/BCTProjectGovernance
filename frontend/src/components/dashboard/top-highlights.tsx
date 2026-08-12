"use client";

import { Sparkles } from "lucide-react";

import type { HighlightRow } from "@/lib/api/dashboard";

// Adapted from design-reference/geo-dashbaord.html's "Top 5 Highlights" card
// — real data (the 5 most recent status-item narrative entries across the
// dashboard's current scope), not a placeholder. Each item's category tag
// carries the mockup's "(Accomplishment/ Upcoming Milestone/ Risk/ Issue/
// Attention/ Support)" context per-row instead of as a static subtitle.
export function TopHighlights({ items = [] }: { items: HighlightRow[] | undefined }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <Sparkles className="size-5 text-[#1a6fc4]" />
        Top 5 Highlights
      </h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No recent updates.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item, index) => (
            <li key={`${item.entity_id}-${index}`} className="flex items-start gap-3 text-sm text-slate-700">
              <span className="mt-0.5 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-slate-500 uppercase">
                {item.category}
              </span>
              <span>
                <strong className="text-slate-900">{item.entity_label}:</strong> {item.description}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
