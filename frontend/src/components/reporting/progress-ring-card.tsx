"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { PeriodActivityItem, ReportingActivitySeries } from "@/lib/reporting-activity";

// Donut geometry — background ring is the "pending" remainder; the on-time
// and late arcs are drawn over it (same stroke-dasharray technique as
// dashboard/pmo-reporting-compliance-donut.tsx).
const R = 42;
const STROKE = 14;
const CIRCUMFERENCE = 2 * Math.PI * R;

type Accent = { arc: string; dot: string };

export const WEEKLY_ACCENT: Accent = { arc: "#10b981", dot: "bg-emerald-500" };
export const MONTHLY_ACCENT: Accent = { arc: "#1a6fc4", dot: "bg-[#1a6fc4]" };

export function ReportingProgressCard({
  title,
  icon: Icon,
  captionNoun,
  series,
  accent,
  comboLabel,
  options,
  value,
  currentId,
  onChange,
  actionHref,
  actionLabel,
}: {
  title: string;
  icon: LucideIcon;
  captionNoun: string;
  series: ReportingActivitySeries;
  accent: Accent;
  comboLabel: string;
  options: PeriodActivityItem[];
  value: string;
  currentId: string | undefined;
  onChange: (id: string) => void;
  actionHref: string;
  actionLabel: string;
}) {
  const { counts, pct } = series;
  const hasOptions = options.length > 0;

  const onTimeLen = counts.total ? (counts.on_time / counts.total) * CIRCUMFERENCE : 0;
  const lateLen = counts.total ? (counts.late / counts.total) * CIRCUMFERENCE : 0;

  const legend = [
    { label: "On Time", dot: accent.dot, count: counts.on_time },
    { label: "Late", dot: "bg-red-500", count: counts.late },
    { label: "Pending", dot: "bg-slate-300", count: counts.pending },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold tracking-wide text-slate-500 uppercase">{title}</h3>
        <Icon className="size-5 text-[#1a6fc4]" />
      </div>

      <div className="flex items-center gap-5">
        <div className="relative size-32 shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="#e2e8f0" strokeWidth={STROKE} />
            {lateLen > 0 ? (
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke="#ef4444"
                strokeWidth={STROKE}
                strokeDasharray={`${lateLen} ${CIRCUMFERENCE - lateLen}`}
                strokeDashoffset={-onTimeLen}
              />
            ) : null}
            {onTimeLen > 0 ? (
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={accent.arc}
                strokeWidth={STROKE}
                strokeDasharray={`${onTimeLen} ${CIRCUMFERENCE - onTimeLen}`}
                strokeDashoffset={0}
              />
            ) : null}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-slate-900">{pct}%</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold text-slate-900">
            {counts.submitted} / {counts.total}
          </div>
          <div className="text-sm text-slate-500">{captionNoun} Submitted</div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {legend.map((row) => (
              <li key={row.label} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className={cn("inline-block size-2.5 rounded-full", row.dot)} />
                  {row.label}
                </span>
                <span className="font-semibold text-slate-900">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <NativeSelect
            aria-label={comboLabel}
            className="h-10 bg-white text-sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={!hasOptions}
          >
            {hasOptions ? (
              <>
                <option value="" disabled>
                  Select…
                </option>
                {options.map((option) => (
                  <option key={option.period_id} value={option.period_id}>
                    {option.period_id === currentId ? `${option.label} (Current)` : option.label}
                  </option>
                ))}
              </>
            ) : (
              <option value="">No completed reporting period yet</option>
            )}
          </NativeSelect>
        </div>

        {hasOptions ? (
          <Button
            asChild
            className="h-10 shrink-0 gap-2 bg-[#1a4a7a] px-4 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            <Link href={actionHref}>
              <ArrowRight className="size-4" />
              {actionLabel}
            </Link>
          </Button>
        ) : (
          <Button
            disabled
            title="No reporting period has finished yet"
            className="h-10 shrink-0 gap-2 bg-[#1a4a7a] px-4 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            <ArrowRight className="size-4" />
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
