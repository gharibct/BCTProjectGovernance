"use client";

import { Suspense, type ChangeEvent } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { NativeSelect } from "@/components/ui/native-select";
import { ActionTrackerTrigger } from "@/components/action-tracker/action-tracker-trigger";
import type { ActionLevel } from "@/lib/api/actions";
import { useProjects } from "@/lib/api/projects";
import { useAccounts, useGeos, useReportingPeriods } from "@/lib/api/reference-data";
import { useReviewStatusReports, type ReviewScope } from "@/lib/api/status-review";

const SCOPE_ACTION_LEVEL: Record<ReviewScope, ActionLevel> = {
  project: "PROJECT",
  account: "ACCOUNT",
  geo: "GEO",
};
import { GeoAccountMatrixSection } from "./geo-account-matrix-section";
import { OverviewSection } from "./overview-section";
import { RagStatusSection } from "./rag-status-section";
import { ReviewActions } from "./review-actions";
import { ExecutiveUpdateSection } from "@/components/regional-reporting/executive-update-section";

const SCOPE_NAV_LABEL: Record<ReviewScope, string> = {
  project: "Project Dashboard",
  account: "Account Dashboard",
  geo: "Geo Dashboard",
};

const SCOPE_NAV_HREF: Record<ReviewScope, string> = {
  project: "/project-review",
  account: "/account-review",
  geo: "/geo-review",
};

function useEntityName(scope: ReviewScope, scopeId: string): string {
  const { data: projects = [] } = useProjects();
  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();
  if (scope === "project") return projects.find((p) => p.id === scopeId)?.project_code ?? SCOPE_NAV_LABEL.project;
  if (scope === "account") return accounts.find((a) => a.id === scopeId)?.name ?? SCOPE_NAV_LABEL.account;
  return geos.find((g) => g.id === scopeId)?.name ?? SCOPE_NAV_LABEL.geo;
}

function PeriodAwareBody({ scope, scopeId }: { scope: ReviewScope; scopeId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const name = useEntityName(scope, scopeId);
  const { data: periods = [] } = useReportingPeriods();
  const { data: reports = [] } = useReviewStatusReports(scope, scopeId);

  // Reports are ordered by the period's start_date desc (same convention as
  // the Reporting hubs), so the first row is the latest report.
  const urlPeriodId = searchParams.get("period");
  const periodId = urlPeriodId ?? reports[0]?.period_id ?? null;
  const period = periods.find((p) => p.id === periodId);
  const report = reports.find((r) => r.period_id === periodId);

  const onPeriodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    router.replace(`${pathname}?period=${e.target.value}`);
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
          <Link href={SCOPE_NAV_HREF[scope]} className="font-semibold text-[#1a6fc4] hover:underline">
            {SCOPE_NAV_LABEL[scope]}
          </Link>
          {period ? (
            <>
              <ChevronRight className="size-4 text-slate-400" />
              <span className="font-semibold text-slate-600">{period.label}</span>
            </>
          ) : null}
        </nav>
        <div className="mt-4 flex items-center gap-4">
          <h1 className="min-w-0 flex-1 truncate text-4xl font-bold tracking-tight text-slate-900">
            {period ? `${name} - ${period.period_type} Report` : name}
          </h1>
          <ActionTrackerTrigger level={SCOPE_ACTION_LEVEL[scope]} id={scopeId} name={name} />
          {reports.length > 0 ? (
            <div className="w-64 shrink-0">
              <NativeSelect
                value={periodId ?? ""}
                onChange={onPeriodChange}
                chevronClassName="text-[#1a6fc4]"
                className="h-11 rounded-full border-2 border-[#1a6fc4] bg-blue-50 pl-4 pr-10 text-sm font-bold text-[#15406b] shadow-sm transition-colors hover:bg-blue-100"
              >
                {reports.map((r) => {
                  const p = periods.find((pd) => pd.id === r.period_id);
                  return (
                    <option key={r.id} value={r.period_id}>
                      {p?.label ?? r.period_id} — {r.status}
                    </option>
                  );
                })}
              </NativeSelect>
            </div>
          ) : null}
        </div>
      </div>

      {!periodId ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-slate-400">
          No reports submitted yet.
        </p>
      ) : (
        <>
          {scope === "geo" ? (
            <>
              <GeoAccountMatrixSection geoId={scopeId} accented />
              <ExecutiveUpdateSection geoId={scopeId} periodId={periodId} />
              <OverviewSection scope={scope} scopeId={scopeId} periodId={periodId} />
            </>
          ) : (
            <>
              <OverviewSection scope={scope} scopeId={scopeId} periodId={periodId} />
              <RagStatusSection scope={scope} scopeId={scopeId} periodId={periodId} />
            </>
          )}
          <ReviewActions scope={scope} scopeId={scopeId} report={report} />
        </>
      )}
    </div>
  );
}

// Client wrapper reading the dynamic route param — matches the pattern used
// by reporting/regional-reporting-hub.tsx for its scope-parameterized routes.
export function StatusReviewPage({ scope, paramName }: { scope: ReviewScope; paramName: string }) {
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
