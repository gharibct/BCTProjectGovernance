"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";

import { ReportingPeriodPill } from "@/components/shell/reporting-period-badge";
import { PageBanner } from "@/components/shell/page-banner";
import { StatusBadge } from "@/components/forms/status-badge";
import { ActionTrackerTrigger } from "@/components/action-tracker/action-tracker-trigger";
import type { ActionLevel } from "@/lib/api/actions";
import { useAccounts, useGeos, useReportingPeriods } from "@/lib/api/reference-data";
import { useRegionalStatusReports, type RegionalScope } from "@/lib/api/regional-status";

const SCOPE_LABEL: Record<RegionalScope, string> = {
  account: "Account Reporting",
  geo: "Geo Reporting",
};

const SCOPE_ACTION_LEVEL: Record<RegionalScope, ActionLevel> = {
  account: "ACCOUNT",
  geo: "GEO",
};

type RegionalHeaderProps = {
  scope: RegionalScope;
  paramName: string;
  // Static screen name, e.g. "RAG Status" (existing convention — see
  // components/shell/project-header.tsx's `subheading`).
  subheading?: string;
  // Account/Geo Status page only: ignore `subheading`, use
  // "{period.period_type} Report" instead.
  dynamicSubheading?: boolean;
  // Explicit "which period" override for callers (Account Dashboard) that
  // already resolved one via their own fallback chain — omit to read the raw
  // ?period= off the URL directly (Status page's behavior: no fallback).
  periodId?: string | null;
  // Account/Geo Dashboard only — the Action Tracker trigger lives on
  // Account/Geo Dashboard and Account/Geo Review, not every other
  // Account/Geo Reporting sub-page.
  showActionTracker?: boolean;
};

// Reads the ?period= reporting_periods.id that status-form.tsx also reads —
// the URL is the single source of truth for "which report is being viewed".
function PeriodAwareHeading({
  scope,
  scopeId,
  subheading,
  dynamicSubheading,
  periodId: periodIdProp,
  showActionTracker,
}: {
  scope: RegionalScope;
  scopeId: string;
  subheading?: string;
  dynamicSubheading?: boolean;
  periodId?: string | null;
  showActionTracker?: boolean;
}) {
  const searchParams = useSearchParams();
  const periodId = periodIdProp !== undefined ? periodIdProp : searchParams.get("period");

  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();
  const name =
    scope === "account"
      ? (accounts.find((a) => a.id === scopeId)?.name ?? SCOPE_LABEL.account)
      : (geos.find((g) => g.id === scopeId)?.name ?? SCOPE_LABEL.geo);

  const { data: periods = [] } = useReportingPeriods();
  const { data: reports = [] } = useRegionalStatusReports(scope, scopeId);

  const period = periods.find((p) => p.id === periodId);
  const report = reports.find((r) => r.period_id === periodId);

  const suffix = dynamicSubheading ? (period ? `${period.period_type} Report` : undefined) : subheading;
  const heading = suffix ? `${name} - ${suffix}` : name;

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
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">{heading}</h1>
        <div className="flex flex-wrap items-center gap-4">
          {showActionTracker ? <ActionTrackerTrigger level={SCOPE_ACTION_LEVEL[scope]} id={scopeId} name={name} /> : null}
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-500">Period:</span>
            {period ? <ReportingPeriodPill label={period.label} /> : <span className="text-slate-300">—</span>}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-500">Report Status:</span>
            <StatusBadge value={report?.status ?? ""} size="lg" />
          </span>
        </div>
      </div>
    </>
  );
}

// Every Account/Geo Reporting screen shows the same "<Screen Name> Period:
// <bubble> Report Status: <badge>" line, then the account/geo description
// below — matches the Project Reporting convention (see
// components/shell/project-header.tsx). `paramName` is "accountId" or
// "geoId" depending on which rail is rendering this.
export function RegionalHeader({
  scope,
  paramName,
  subheading,
  dynamicSubheading,
  periodId,
  showActionTracker,
}: RegionalHeaderProps) {
  const params = useParams<Record<string, string>>();
  const scopeId = params[paramName] ?? "";

  const { data: accounts = [] } = useAccounts();
  // Geo has no description field (unlike Account) — no description line for geo scope.
  const description = scope === "account" ? accounts.find((a) => a.id === scopeId)?.description : null;

  return (
    <div>
      {/* useSearchParams (for the selected reporting period) requires a
          Suspense boundary at prerender. */}
      <Suspense fallback={null}>
        <PeriodAwareHeading
          scope={scope}
          scopeId={scopeId}
          subheading={subheading}
          dynamicSubheading={dynamicSubheading}
          periodId={periodId}
          showActionTracker={showActionTracker}
        />
      </Suspense>
      {description?.trim() ? (
        <p className="mt-3 flex items-center gap-2.5 text-slate-500">
          <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
          {description}
        </p>
      ) : null}
      <PageBanner />
    </div>
  );
}
