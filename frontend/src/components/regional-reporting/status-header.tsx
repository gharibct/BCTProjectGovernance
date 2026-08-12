"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { ReportingPeriodPill } from "@/components/shell/reporting-period-badge";
import { PageBanner } from "@/components/shell/page-banner";
import { StatusBadge } from "@/components/forms/status-badge";
import { useAccounts, useGeos, useReportingPeriods } from "@/lib/api/reference-data";
import { useRegionalStatusReports, type RegionalScope } from "@/lib/api/regional-status";

const SCOPE_LABEL: Record<RegionalScope, string> = {
  account: "Account Reporting",
  geo: "Geo Reporting",
};

// Reads the ?period= reporting_periods.id that status-form.tsx also reads —
// the URL is the single source of truth for "which report is being viewed".
// Mirrors project-status/status-header.tsx, minus the trailing status badge
// (accounts/geos have no lifecycle status field the way a Project does).
function PeriodAwareHeading({ scope, scopeId }: { scope: RegionalScope; scopeId: string }) {
  const searchParams = useSearchParams();
  const periodId = searchParams.get("period");

  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();
  const name =
    scope === "account"
      ? (accounts.find((a) => a.id === scopeId)?.name ?? SCOPE_LABEL.account)
      : (geos.find((g) => g.id === scopeId)?.name ?? SCOPE_LABEL.geo);

  const { data: periods } = useReportingPeriods();
  const { data: reports } = useRegionalStatusReports(scope, scopeId);

  const period = periods?.find((p) => p.id === periodId);
  const report = reports?.find((r) => r.period_id === periodId);

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        <Link href={`/${scope}-reporting/${scopeId}`} className="font-semibold text-[#1a6fc4] hover:underline">
          {SCOPE_LABEL[scope]}
        </Link>
        {period ? (
          <>
            <ChevronRight className="size-4 text-slate-400" />
            <span className="font-semibold text-slate-600">{period.label}</span>
          </>
        ) : null}
      </nav>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            {period ? `${name} - ${period.period_type} Report` : name}
          </h1>
          {period ? <ReportingPeriodPill label={period.label} /> : null}
          {report ? <StatusBadge value={report.status} size="lg" /> : null}
        </div>
      </div>
    </>
  );
}

export function StatusHeader({ scope, scopeId }: { scope: RegionalScope; scopeId: string }) {
  return (
    <div>
      {/* useSearchParams (for the selected reporting period) requires a
          Suspense boundary at prerender. */}
      <Suspense fallback={null}>
        <PeriodAwareHeading scope={scope} scopeId={scopeId} />
      </Suspense>
      <PageBanner />
    </div>
  );
}
