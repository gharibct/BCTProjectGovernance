"use client";

import { useParams, useSearchParams } from "next/navigation";

import { PageBreadcrumb } from "@/components/shell/page-breadcrumb";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { useReportingPeriod } from "@/components/shell/reporting-period-badge";

// `periodLabel` lets a screen with a real reporting_periods selection (see
// components/shell/project-header.tsx) override the generic sample-data
// period shown by default — every other caller is unaffected.
export function ReportingBreadcrumb({ periodLabel }: { periodLabel?: string } = {}) {
  const { projectId } = useParams<{ projectId: string }>();
  const genericPeriod = useReportingPeriod();
  const period = periodLabel ?? genericPeriod;

  // Weekly periods belong to Update Project Status Report, Monthly to Report Project
  // Performance — link back to the matching hub.
  const periodId = useSearchParams().get("period");
  const { data: periods = [] } = useReportingPeriods();
  const isPerformance = periods.find((p) => p.id === periodId)?.period_type === "Monthly";

  return (
    <PageBreadcrumb
      items={[
        {
          label: isPerformance ? "Update Project Performance Report" : "Update Project Status Report",
          href: `/project-reporting/${projectId}/${isPerformance ? "performance" : "delivery-calendar"}`,
        },
        { label: period },
      ]}
    />
  );
}
