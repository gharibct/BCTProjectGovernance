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
import type { ProjectStatusReport } from "@/lib/api/project-status";
import { CustomerCommunicationSection } from "./customer-communication-section";
import { RagStatusSection } from "./rag-status-section";
import { OpenNcSection } from "./open-nc-section";
import { ReviewActions } from "./review-actions";
import { ExecutiveUpdateSection } from "@/components/regional-reporting/executive-update-section";

const SCOPE_NAV_LABEL: Record<ReviewScope, string> = {
  project: "Project Delivery Status",
  account: "Delivery Status Report - Account",
  geo: "Delivery Status Report - Geo",
};

// "approve" is a reviewer's worklist copy of the report (with the Approve / Reject
// bar); "view" is the read-only report under My Reports. Project and account
// reports have both; the geo report keeps a single page with its bar.
export type StatusReviewMode = "view" | "approve";

const APPROVE_NAV_LABEL: Partial<Record<ReviewScope, string>> = {
  project: "Approve Project Delivery Status",
  account: "Approve Account Delivery Status",
};
const APPROVE_NAV_HREF: Partial<Record<ReviewScope, string>> = {
  project: "/select-project/project-approval",
  account: "/select-account/account-approval",
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

function PeriodAwareBody({ scope, scopeId, mode }: { scope: ReviewScope; scopeId: string; mode: StatusReviewMode }) {
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

  // A caller that links into this report from somewhere other than the
  // bare review list (e.g. Project Health's Report Submissions grid,
  // project-health-report-submissions.tsx) can carry a `?back=` path so
  // this breadcrumb returns there instead of defaulting to SCOPE_NAV_HREF.
  const back = searchParams.get("back");
  const approving = scope !== "geo" && mode === "approve";
  // Project / Account Delivery Status (view) are for reading only — their decision
  // bar moved to the approve pages. The Geo report keeps its own.
  const viewOnly = scope !== "geo" && mode === "view";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
          <Link
            href={back || (approving ? APPROVE_NAV_HREF[scope] : undefined) || SCOPE_NAV_HREF[scope]}
            className="font-semibold text-[#1a6fc4] hover:underline"
          >
            {back ? "Report Submissions" : approving ? APPROVE_NAV_LABEL[scope] : SCOPE_NAV_LABEL[scope]}
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
              {scope === "project" ? (
                // Under scope "project" the reports are ProjectStatusReports.
                <CustomerCommunicationSection projectId={scopeId} report={report as ProjectStatusReport | undefined} />
              ) : null}
            </>
          )}
          <OpenNcSection scope={scope} scopeId={scopeId} report={report} />
          <ReviewActions scope={scope} scopeId={scopeId} report={report} readOnly={viewOnly} />
        </>
      )}
    </div>
  );
}

// Client wrapper reading the dynamic route param — matches the pattern used
// by reporting/regional-reporting-hub.tsx for its scope-parameterized routes.
export function StatusReviewPage({
  scope,
  paramName,
  mode = "view",
}: {
  scope: ReviewScope;
  paramName: string;
  mode?: StatusReviewMode;
}) {
  const params = useParams<Record<string, string>>();
  const scopeId = params[paramName] ?? "";

  return (
    // useSearchParams (for the selected reporting period) requires a
    // Suspense boundary at prerender.
    <Suspense fallback={null}>
      <PeriodAwareBody scope={scope} scopeId={scopeId} mode={mode} />
    </Suspense>
  );
}
