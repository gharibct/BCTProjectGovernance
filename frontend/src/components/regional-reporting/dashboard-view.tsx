"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { ExecutiveUpdateSection } from "./executive-update-section";
import { RegionalHeader } from "./regional-header";
import { SubmitReportAction } from "./submit-report-action";
import { GeoAccountMatrixSection } from "@/components/status-review/geo-account-matrix-section";
import { OverviewSection } from "@/components/status-review/overview-section";
import { RagStatusSection } from "@/components/status-review/rag-status-section";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { useRegionalStatusReports, type RegionalScope } from "@/lib/api/regional-status";
import { currentPeriod } from "@/lib/period-utils";

// The Account Manager's / Geo Head's read-first counterpart to
// /account-review /geo-review — same OverviewSection/RagStatusSection the
// reviewer sees, fitted into the regional-reporting shell (nav rail) instead
// of the standalone review layout, with SubmitReportAction in place of
// ReviewActions. Mirrors components/project-dashboard/project-dashboard-view.tsx,
// scope-generic like the rest of regional-reporting.
function PeriodAwareBody({ scope, scopeId }: { scope: RegionalScope; scopeId: string }) {
  const searchParams = useSearchParams();

  const { data: periods = [] } = useReportingPeriods();
  const { data: reports = [] } = useRegionalStatusReports(scope, scopeId);

  // Reports are ordered by the period's start_date desc, so the first row is
  // the latest one. Falls back to the current month when neither the URL nor
  // any report has picked a period yet — same "no ?period= yet" fallback
  // Project Dashboard / StarterCards use — so this page isn't a dead end on a
  // manager's very first visit, before anything has ever been submitted.
  const urlPeriodId = searchParams.get("period");
  const periodId = urlPeriodId ?? reports[0]?.period_id ?? currentPeriod(periods, "Monthly")?.id ?? null;
  const report = reports.find((r) => r.period_id === periodId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <RegionalHeader
        scope={scope}
        paramName={scope === "account" ? "accountId" : "geoId"}
        subheading={scope === "account" ? "Account Dashboard" : "Geo Dashboard"}
        periodId={periodId}
        showActionTracker
      />

      {!periodId ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-slate-400">
          No reporting period available yet.
        </p>
      ) : scope === "geo" ? (
        // Geo Dashboard order: Summary (the accented Account Governance
        // Matrix) first, then the Geo Head's own Executive Update content
        // section by section, then the Overview (KPI snapshot + 2x2
        // category grid), then Submit.
        <>
          <GeoAccountMatrixSection geoId={scopeId} accented />
          <ExecutiveUpdateSection geoId={scopeId} periodId={periodId} />
          <OverviewSection scope={scope} scopeId={scopeId} periodId={periodId} />
          <SubmitReportAction scope={scope} scopeId={scopeId} periodId={periodId} report={report} />
        </>
      ) : (
        <>
          <OverviewSection scope={scope} scopeId={scopeId} periodId={periodId} />
          <RagStatusSection scope={scope} scopeId={scopeId} periodId={periodId} />
          <SubmitReportAction scope={scope} scopeId={scopeId} periodId={periodId} report={report} />
        </>
      )}
    </div>
  );
}

export function RegionalDashboardView({ scope, paramName }: { scope: RegionalScope; paramName: string }) {
  const params = useParams<Record<string, string>>();
  const scopeId = params[paramName] ?? "";

  return (
    // useSearchParams (for the selected reporting period) requires a
    // Suspense boundary at prerender.
    <Suspense fallback={null}>
      <PeriodAwareBody scope={scope} scopeId={scopeId} />
    </Suspense>
  );
}
