"use client";

import { CalendarDays } from "lucide-react";
import { useSearchParams } from "next/navigation";

// Reporting runs on a monthly cycle. Falls back to the current month when no
// period was carried in the URL (sample value until there's a backend).
export const CURRENT_PERIOD = "Jul 2026";

export function useReportingPeriod() {
  const params = useSearchParams();
  return params.get("period") ?? CURRENT_PERIOD;
}

export function ReportingPeriodBadge() {
  const period = useReportingPeriod();

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1.5 text-sm font-bold whitespace-nowrap text-[#15406b]">
      <CalendarDays className="size-4" />
      Reporting Period: {period}
    </span>
  );
}
