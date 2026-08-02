import { Suspense } from "react";

import { ReportingBreadcrumb } from "@/components/shell/reporting-breadcrumb";
import { ReportingPeriodBadge } from "@/components/shell/reporting-period-badge";
import { StatusBadge } from "@/components/forms/status-badge";

// Sample project identity until project data has a backend.
const PROJECT_CODE = "PRJ-2026-0042";
const PROJECT_DESCRIPTION =
  "Modernization of the core banking platform for Gulf National Bank, covering deposits, lending and payments modules across APAC operations.";
const PROJECT_STATUS = "Approved";

export function ProjectHeader() {
  return (
    <div>
      {/* useSearchParams (for the period) requires a Suspense boundary */}
      <Suspense fallback={null}>
        <ReportingBreadcrumb />
      </Suspense>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            {PROJECT_CODE}
          </h1>
          {/* useSearchParams requires a Suspense boundary at prerender */}
          <Suspense fallback={null}>
            <ReportingPeriodBadge />
          </Suspense>
        </div>
        <StatusBadge value={PROJECT_STATUS} size="lg" />
      </div>
      <p className="mt-3 flex items-center gap-2.5 text-slate-500">
        <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
        {PROJECT_DESCRIPTION}
      </p>
    </div>
  );
}
