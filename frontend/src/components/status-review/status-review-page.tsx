"use client";

import { Suspense, useMemo, type ChangeEvent } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

import { PageBreadcrumb } from "@/components/shell/page-breadcrumb";
import { selectProjectHref } from "@/lib/project-context-targets";
import { selectAccountHref } from "@/lib/account-context-targets";

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
import { isReportFrozen, type ProjectStatusReport } from "@/lib/api/project-status";
import { ReportAttachmentsView } from "@/components/reporting/report-attachments-section";
import { CustomerCommunicationSection } from "./customer-communication-section";
import { RagStatusSection } from "./rag-status-section";
import { OpenNcSection } from "./open-nc-section";
import { ReviewActions } from "./review-actions";
import { ExecutiveUpdateSection } from "@/components/regional-reporting/executive-update-section";

const SCOPE_NAV_LABEL: Record<ReviewScope, string> = {
  project: "Project Delivery Status",
  account: "Account Delivery Status",
  geo: "Geo Delivery Status",
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
  project: "/project-approval",
  account: "/account-approval",
};

// The bare /project-review, /account-review and /geo-review routes do not exist
// (only the /[id] children), so link to the project / account picker pages. The
// geo report has no landing page (geos are picked from the menu), so its first crumb is plain text.
const SCOPE_NAV_HREF: Record<ReviewScope, string | undefined> = {
  project: selectProjectHref("project-review"),
  account: selectAccountHref("account-review"),
  geo: undefined,
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
  const { data: allReports = [] } = useReviewStatusReports(scope, scopeId);
  // My Reports (view) only shows filed reports for projects / accounts — Draft
  // / Rejected ones are still being worked on by the reporter. Geo reports
  // (Geo Head and CXO) show in every status, incl. Auto Generated. The approve
  // worklist (project / account) lists only Submitted reports — the ones
  // actually awaiting a decision.
  const reports = useMemo(() => {
    if (scope === "geo") return allReports;
    if (mode === "approve") return allReports.filter((r) => r.status === "Submitted");
    return allReports.filter((r) => isReportFrozen(r.status));
  }, [allReports, mode, scope]);

  // Reports are ordered by the period's start_date desc (same convention as
  // the Reporting hubs), so the first row is the latest report.
  const urlPeriodId = searchParams.get("period");
  // A ?period= that is no longer listed (e.g. just approved, so it left the
  // approve worklist) falls back to the first remaining report, so the
  // Approve / Reject bar is available by default.
  //
  // Exception: when opened from a drill-down grid (`?back=`, e.g. High Risks),
  // the period is the one the row was about — if no report is filed for it, show
  // that rather than silently showing a different week's report.
  const cameFromGrid = !!searchParams.get("back");
  const periodId =
    (urlPeriodId && reports.some((r) => r.period_id === urlPeriodId) ? urlPeriodId : null) ??
    (cameFromGrid && urlPeriodId ? null : (reports[0]?.period_id ?? null));
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
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <div>
        <PageBreadcrumb
          items={[
            {
              label: back
                ? back.startsWith("/high-risks")
                  ? "High Risks"
                  : "Report Submissions"
                : approving
                  ? APPROVE_NAV_LABEL[scope]!
                  : SCOPE_NAV_LABEL[scope],
              href: back || (approving ? APPROVE_NAV_HREF[scope] : undefined) || SCOPE_NAV_HREF[scope],
            },
            ...(period ? [{ label: period.label }] : [{ label: name }]),
          ]}
        />
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
          {approving
            ? "No reports awaiting approval."
            : cameFromGrid && urlPeriodId
              ? "No report has been submitted for this period."
              : "No reports submitted yet."}
        </p>
      ) : (
        <>
          {scope === "geo" ? (
            <>
              <GeoAccountMatrixSection geoId={scopeId} periodId={periodId} accented />
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
              <ReportAttachmentsView scope={scope} ownerId={scopeId} reportId={report?.id} />
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
