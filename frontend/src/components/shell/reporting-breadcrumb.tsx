"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { useReportingPeriod } from "@/components/shell/reporting-period-badge";

// `periodLabel` lets a screen with a real reporting_periods selection (see
// components/shell/project-header.tsx) override the generic sample-data
// period shown by default — every other caller is unaffected.
export function ReportingBreadcrumb({ periodLabel }: { periodLabel?: string } = {}) {
  const { projectId } = useParams<{ projectId: string }>();
  const genericPeriod = useReportingPeriod();
  const period = periodLabel ?? genericPeriod;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link
        href={`/project-reporting/${projectId}`}
        className="font-semibold text-[#1a6fc4] hover:underline"
      >
        Project Reporting
      </Link>
      <ChevronRight className="size-4 text-slate-400" />
      <span className="font-semibold text-slate-600">{period}</span>
    </nav>
  );
}
