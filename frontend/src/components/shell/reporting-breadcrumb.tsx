"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { useReportingPeriod } from "@/components/shell/reporting-period-badge";

export function ReportingBreadcrumb() {
  const period = useReportingPeriod();

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link
        href="/project-reporting"
        className="font-semibold text-[#1a6fc4] hover:underline"
      >
        Project Reporting
      </Link>
      <ChevronRight className="size-4 text-slate-400" />
      <span className="font-semibold text-slate-600">{period}</span>
    </nav>
  );
}
