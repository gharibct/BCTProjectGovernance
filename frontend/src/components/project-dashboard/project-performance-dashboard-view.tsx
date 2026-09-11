"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bug,
  CheckCircle2,
  Circle,
  GitBranch,
  Handshake,
  HelpCircle,
  Lightbulb,
  Wallet,
} from "lucide-react";

import { ProjectHeader } from "@/components/shell/project-header";
import { BigStat, Card, ErrorBlock, formatNumber, SubStat } from "@/components/dashboard/project-health-kpi";
import { useProjectPerformanceDashboard } from "@/lib/api/project-performance";
import { REPORT_PAGE_TYPE_LABEL, type PageCompletionStatus } from "@/lib/api/reporting-attestation";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { useStatusReports } from "@/lib/api/project-status";
import { currentPeriod } from "@/lib/period-utils";
import { cn } from "@/lib/utils";
import { SubmitReportAction } from "./submit-report-action";

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

function CompletionChecklist({ completion }: { completion: PageCompletionStatus[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-slate-900">Monthly Completion Checklist</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {completion.map((item) => (
          <li
            key={item.page_type}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
              item.complete
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              {item.complete ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
              {REPORT_PAGE_TYPE_LABEL[item.page_type]}
            </span>
            <span className="text-xs">
              {item.reason === "data_saved"
                ? "Data recorded"
                : item.reason === "reviewed_no_changes"
                  ? `Reviewed${item.reviewed_at ? ` ${formatShortDate(item.reviewed_at)}` : ""}`
                  : "Outstanding"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Presentational body shared by the PM's own monthly Project Dashboard
// (below, with a gated Submit Report) and the Account Manager's read-only
// /project-performance/[projectId] view (readOnly — no Submit Report, no
// attestation buttons anywhere on the page it's embedded in).
export function PerformanceDashboardBody({
  projectId,
  periodId,
  readOnly,
}: {
  projectId: string;
  periodId: string;
  readOnly?: boolean;
}) {
  const { data, isLoading, isError, error, refetch } = useProjectPerformanceDashboard(projectId, periodId);
  const { data: reports = [] } = useStatusReports(projectId);

  // Reads go to the plain project-reporting pages (with the PM's full
  // editing nav rail) on the PM's own dashboard, but to the read-only
  // Account Head module views (no editing, no reporting nav) when this body
  // is embedded read-only on /project-performance.
  const base = readOnly ? `/project-performance/${projectId}` : `/project-reporting/${projectId}`;

  if (isError) {
    return (
      <ErrorBlock
        title="Couldn't load the Project Performance Dashboard."
        error={error}
        onRetry={() => refetch()}
      />
    );
  }
  if (isLoading || !data) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Measurements"
          icon={BarChart3}
          iconClassName="text-[#1a6fc4]"
          href={`${base}/measurement?period=${periodId}`}
        >
          <BigStat value={`${data.metrics.compliant_pct}%`} label="Compliant" />
          <div className="flex flex-col gap-1">
            <SubStat label="Below Target" value={data.metrics.below_target_count} valueClass="text-amber-600" />
            <SubStat label="Not Reported" value={data.metrics.not_reported_count} />
            <SubStat
              label="Critical Variance"
              value={data.metrics.critical_variance_count}
              valueClass="text-red-600"
            />
          </div>
        </Card>

        <Card
          title="Commitments"
          icon={Handshake}
          iconClassName="text-teal-600"
          href={`${base}/contractual-compliance?period=${periodId}`}
        >
          <BigStat value={data.commitments.open_count} label="Open" />
          <div className="flex flex-col gap-1">
            <SubStat label="Due Soon" value={data.commitments.due_soon_count} valueClass="text-amber-600" />
            <SubStat label="Overdue" value={data.commitments.overdue_count} valueClass="text-red-600" />
            <SubStat label="Breached" value={data.commitments.breached_count} valueClass="text-red-600" />
          </div>
        </Card>

        <Card
          title="Payment Milestones"
          icon={Wallet}
          iconClassName="text-emerald-600"
          href={`${base}/contractual-compliance?period=${periodId}`}
        >
          <BigStat
            value={formatNumber(data.payment_milestones.value_due)}
            label="Value Due"
            valueClass="text-emerald-600"
          />
          <div className="flex flex-col gap-1">
            <SubStat label="Due" value={data.payment_milestones.due_count} />
            <SubStat label="Overdue" value={data.payment_milestones.overdue_count} valueClass="text-red-600" />
          </div>
        </Card>

        <Card
          title="Risks"
          icon={AlertTriangle}
          iconClassName="text-red-600"
          href={`${base}/raido?period=${periodId}`}
        >
          <BigStat value={data.risks.open_count} label="Open" />
          <div className="flex flex-col gap-1">
            <SubStat label="Overdue" value={data.risks.overdue_count} valueClass="text-red-600" />
            <SubStat label="No Mitigation" value={data.risks.no_mitigation_count} valueClass="text-amber-600" />
          </div>
        </Card>

        <Card
          title="Issues"
          icon={Bug}
          iconClassName="text-amber-500"
          href={`${base}/raido?period=${periodId}`}
        >
          <BigStat value={data.issues.open_count} label="Open" />
          <div className="flex flex-col gap-1">
            <SubStat label="Critical" value={data.issues.critical_count} valueClass="text-red-600" />
            <SubStat label="Overdue" value={data.issues.overdue_count} />
          </div>
        </Card>

        <Card
          title="Dependencies"
          icon={GitBranch}
          iconClassName="text-purple-600"
          href={`${base}/raido?period=${periodId}`}
        >
          <BigStat value={data.dependencies.open_count} label="Open" />
          <div className="flex flex-col gap-1">
            <SubStat label="Overdue" value={data.dependencies.overdue_count} valueClass="text-red-600" />
            <SubStat label="Critical" value={data.dependencies.critical_count} valueClass="text-red-600" />
          </div>
        </Card>

        <Card
          title="Assumptions"
          icon={HelpCircle}
          iconClassName="text-blue-600"
          href={`${base}/raido?period=${periodId}`}
        >
          <BigStat value={data.assumptions.open_count} label="Open" />
          <div className="flex flex-col gap-1">
            <SubStat label="Review Due" value={data.assumptions.review_due_count} valueClass="text-amber-600" />
            <SubStat label="Overdue" value={data.assumptions.overdue_count} valueClass="text-red-600" />
          </div>
        </Card>

        <Card
          title="Opportunities"
          icon={Lightbulb}
          iconClassName="text-yellow-600"
          href={`${base}/raido?period=${periodId}`}
        >
          <BigStat value={data.opportunities.open_count} label="Open" />
          <div className="flex flex-col gap-1">
            <SubStat
              label="High Priority"
              value={data.opportunities.high_priority_count}
              valueClass="text-amber-600"
            />
            <SubStat label="Pending Approval" value={data.opportunities.pending_approval_count} />
          </div>
        </Card>
      </div>

      <CompletionChecklist completion={data.completion} />

      {!readOnly ? (
        <SubmitReportAction
          projectId={projectId}
          periodId={periodId}
          report={reports.find((r) => r.period_id === periodId)}
          disabled={!data.all_complete}
          disabledReason={
            data.all_complete
              ? undefined
              : "Complete every section above — save data or mark Reviewed and No Changes — before submitting this month's report."
          }
        />
      ) : null}
    </div>
  );
}

// Full-page wrapper for the PM's own monthly reporting flow — resolves
// projectId/period itself and renders the shared chrome, mirroring
// ProjectDashboardView (its Weekly counterpart).
function PeriodAwareBody({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const { data: periods = [] } = useReportingPeriods();
  const { data: reports = [] } = useStatusReports(projectId);

  const urlPeriodId = searchParams.get("period");
  const periodId = urlPeriodId ?? reports[0]?.period_id ?? currentPeriod(periods, "Monthly")?.id ?? null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <ProjectHeader subheading="Project Performance Dashboard" periodId={periodId} showActionTracker />
      {!periodId ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-slate-400">
          No reporting period available yet.
        </p>
      ) : (
        <PerformanceDashboardBody projectId={projectId} periodId={periodId} />
      )}
    </div>
  );
}

export function ProjectPerformanceDashboardView() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    // useSearchParams (for the selected reporting period) requires a
    // Suspense boundary at prerender.
    <Suspense fallback={null}>
      <PeriodAwareBody projectId={projectId} />
    </Suspense>
  );
}
