"use client";

import { Bot } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AiSuggestion } from "@/lib/api/ai-suggestions";

// AI-Implementation.md §6 — three confidence tiers, one badge color each.
// Thresholds are this app's own call (the doc doesn't specify exact cutoffs).
// Exported for the row-level equivalent (ai-row-suggestions-panel.tsx, §10).
export const CONFIDENCE_TIERS = [
  { min: 0.8, label: "High", boxClass: "bg-emerald-500 hover:bg-emerald-600" },
  { min: 0.5, label: "Medium", boxClass: "bg-amber-400 hover:bg-amber-500" },
  { min: 0, label: "Low", boxClass: "bg-red-500 hover:bg-red-600" },
] as const;

export function confidenceTier(confidence: number) {
  return CONFIDENCE_TIERS.find((tier) => confidence >= tier.min) ?? CONFIDENCE_TIERS[2];
}

// AI-Implementation.md §6/§7: a small confidence-colored box sits before the
// control it suggested a value for; clicking it opens the suggestion's
// confidence/source/evidence. The value itself is already loaded into the
// control (see charter-form's auto-apply effect) — the PM can type over it,
// or use Revert to Old Value here to restore whatever was there before the
// suggestion overwrote it.
export function AiFieldBadge({
  suggestion,
  onRevert,
}: {
  suggestion: AiSuggestion;
  onRevert: () => void;
}) {
  const tier = confidenceTier(suggestion.confidence);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`AI suggestion — ${tier.label} confidence. Click for details.`}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md text-white transition-colors",
            tier.boxClass
          )}
        >
          <Bot className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <Bot className="size-4 text-[#1a6fc4]" />
          AI Suggestion
        </p>
        <dl className="mt-3 flex flex-col gap-2.5 text-xs">
          <div>
            <dt className="font-bold tracking-wide text-slate-400 uppercase">Confidence</dt>
            <dd className="mt-0.5 text-slate-700">
              {tier.label} ({Math.round(suggestion.confidence * 100)}%)
            </dd>
          </div>
          {suggestion.source_document ? (
            <div>
              <dt className="font-bold tracking-wide text-slate-400 uppercase">Source</dt>
              <dd className="mt-0.5 text-slate-700">
                {suggestion.source_document}
                {suggestion.source_location ? ` — ${suggestion.source_location}` : ""}
              </dd>
            </div>
          ) : null}
          {suggestion.evidence ? (
            <div>
              <dt className="font-bold tracking-wide text-slate-400 uppercase">Evidence</dt>
              <dd className="mt-0.5 text-slate-600 italic">&ldquo;{suggestion.evidence}&rdquo;</dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-4 flex justify-end gap-2">
          <PopoverClose asChild>
            <Button variant="outline" size="sm" onClick={onRevert}>
              Revert to Old Value
            </Button>
          </PopoverClose>
          <PopoverClose asChild>
            <Button size="sm">OK</Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
