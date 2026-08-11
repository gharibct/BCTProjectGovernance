"use client";

import { CalendarDays } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { useReportingPeriods } from "@/lib/api/reference-data";

// Reporting runs on a monthly cycle. Falls back to the current month when no
// period was carried in the URL (sample value until there's a backend).
export const CURRENT_PERIOD = "Jul 2026";

// `?period=` on the URL is a reporting_periods id, not a label — resolve it
// against the real list so callers never render the raw UUID.
export function useReportingPeriod() {
  const params = useSearchParams();
  const periodId = params.get("period");
  const { data: periods = [] } = useReportingPeriods();
  if (!periodId) return CURRENT_PERIOD;
  return periods.find((p) => p.id === periodId)?.label ?? CURRENT_PERIOD;
}

// Presentational pill, split out so screens with a real reporting_periods
// selection (see components/project-status/status-header.tsx) can render the
// same bubble with a real period label instead of this file's generic
// sample-data hook.
export function ReportingPeriodPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1.5 text-sm font-bold whitespace-nowrap text-[#15406b]">
      <CalendarDays className="size-4" />
      Reporting Period: {label}
    </span>
  );
}

export function ReportingPeriodBadge() {
  const period = useReportingPeriod();
  return <ReportingPeriodPill label={period} />;
}
