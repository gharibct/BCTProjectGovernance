"use client";

import * as React from "react";
import {
  AlertTriangle,
  BarChart3,
  Bug,
  ClipboardCheck,
  Database,
  FolderOpen,
  Handshake,
  HeartPulse,
  Lightbulb,
  ListChecks,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  useProjectHealthDashboardSummary,
  type ProjectHealthDashboardFilters,
  type ReportSubmissionKpi,
} from "@/lib/api/project-health-dashboard";
import { REPORT_SUBMISSION_STREAMS } from "@/lib/api/project-health-lists";
import { useEffectiveRole } from "@/stores/session";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BigStat, Card, SubStat } from "./project-health-kpi";
import { useCanSeeOracleProjects } from "./project-health-oracle-projects";
import { ProjectHealthOracleProjectsSection } from "./project-health-oracle-projects-section";

// Project Health dashboard (design-reference/Project-Health.html) — an
// org-wide, portfolio-level KPI page for PMO/Admin/CDO. Restyled to this
// app's real design system (plain white/slate cards, emerald/amber/red RAG,
// #1a6fc4 accent — see account-head-my-summary.tsx/pmo-my-summary.tsx for
// the established pattern) rather than the mockup's own Material palette.

function formatNumber(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : value;
}

// Groups the KPI cards below to mirror the right-side "Reports" nav's own
// sections (project-health-nav.tsx SECTIONS), each as a tinted pill header.
function SectionHeader({
  title,
  icon: Icon,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
}) {
  return (
    <div
      className={cn(
        "flex w-fit items-center gap-2 rounded-full border px-4 py-1.5",
        className,
      )}
    >
      <Icon className="size-4" />
      <span className="text-xs font-bold tracking-wide uppercase">{title}</span>
    </div>
  );
}

// Compact Green/Amber/Pot. Red/Red/Not Submitted count strip shared by the Project
// Health, Account Health and DE-assessed health cards — kept small so all three
// cards sit in one row. `notLabel` renames the last cell (e.g. "Not Assessed").
function RagCounts({
  green,
  amber,
  potentialRed,
  red,
  notSubmitted,
  notLabel = "Not Sub.",
}: {
  green: React.ReactNode;
  amber: React.ReactNode;
  potentialRed: React.ReactNode;
  red: React.ReactNode;
  notSubmitted: React.ReactNode;
  notLabel?: string;
}) {
  return (
    <div className="grid grid-cols-5 gap-1">
      <RagCell label="Green" value={green} className="border-emerald-100 bg-emerald-50 text-emerald-700" valueClassName="text-emerald-600" />
      <RagCell label="Amber" value={amber} className="border-amber-100 bg-amber-50 text-amber-700" valueClassName="text-amber-500" />
      <RagCell label="Pot. Red" value={potentialRed} className="border-orange-100 bg-orange-50 text-orange-700" valueClassName="text-orange-600" />
      <RagCell label="Red" value={red} className="border-red-100 bg-red-50 text-red-700" valueClassName="text-red-600" />
      <RagCell label={notLabel} value={notSubmitted} className="border-slate-200 bg-slate-50 text-slate-500" valueClassName="text-slate-900" />
    </div>
  );
}

function RagCell({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  className: string;
  valueClassName: string;
}) {
  return (
    <div className={cn("rounded-md border p-1 text-center", className)}>
      <p className="text-[9px] font-semibold tracking-wide uppercase">{label}</p>
      <p className={cn("text-sm font-bold", valueClassName)}>{value}</p>
    </div>
  );
}

// Adherence % tone — mirrors the RAG palette used across this page.
function adherenceTone(pct: number): string {
  if (pct >= 90) return "text-emerald-600";
  if (pct >= 75) return "text-amber-600";
  return "text-red-600";
}

// "geo" reports are baselined (never submitted / approved) and can still be
// Auto Generated; project and account reports go Not Submitted -> Submitted -> Approved.
// Project Performance (monthly) keeps the plain Submitted / Not Submitted pair.
function ReportSubmissionCard({
  title,
  kpi,
  href,
  period,
  variant = "submission",
}: {
  title: string;
  period: string;
  kpi: ReportSubmissionKpi;
  href: string;
  variant?: "submission" | "approval" | "baseline";
}) {
  const notSubmitted = Math.max(kpi.expected_count - kpi.submitted_count, 0);
  return (
    <Card
      title={title}
      icon={ClipboardCheck}
      iconClassName="text-slate-500"
      href={href}
      footerLabel="View Pending Submissions"
      period={period}
    >
      <BigStat
        value={`${kpi.adherence_pct}%`}
        label="Adherence"
        valueClass={adherenceTone(kpi.adherence_pct)}
      />
      <div className="flex flex-col gap-1">
        {variant === "baseline" ? (
          <>
            <SubStat label="Baselined" value={kpi.submitted_count} />
            <SubStat
              label="Not Baselined"
              value={Math.max(notSubmitted - kpi.auto_generated_count, 0)}
              valueClass={notSubmitted - kpi.auto_generated_count > 0 ? "text-red-600" : undefined}
            />
            <SubStat label="Auto Generated" value={kpi.auto_generated_count} />
          </>
        ) : variant === "approval" ? (
          <>
            <SubStat label="Not Submitted" value={notSubmitted} valueClass={notSubmitted > 0 ? "text-red-600" : undefined} />
            <SubStat label="Submitted" value={Math.max(kpi.submitted_count - kpi.approved_count, 0)} />
            <SubStat label="Approved" value={kpi.approved_count} />
          </>
        ) : (
          <>
            <SubStat label="Submitted" value={kpi.submitted_count} />
            <SubStat label="Not Submitted" value={notSubmitted} valueClass={notSubmitted > 0 ? "text-red-600" : undefined} />
          </>
        )}
      </div>
    </Card>
  );
}

// Customer reporting cards — same shape as ReportSubmissionCard (adherence %
// + counts). Adherence = Shared / (Shared + Not Shared + Not Submitted); the
// accounts card has no Not Submitted, and its New accounts are left out of the
// percentage (shown for information only).
function CustomerReportCard({
  title,
  shared,
  notShared,
  notSubmitted,
  href,
  period,
}: {
  title: string;
  href: string;
  period: string;
  shared: number;
  notShared: number;
  notSubmitted?: number;
}) {
  const expected = shared + notShared + (notSubmitted ?? 0);
  const adherencePct = expected > 0 ? Math.round((shared / expected) * 100) : 0;
  return (
    <Card title={title} icon={Users} iconClassName="text-[#1a6fc4]" href={href} footerLabel="View Details" period={period}>
      <BigStat value={`${adherencePct}%`} label="Adherence" valueClass={adherenceTone(adherencePct)} />
      <div className="flex flex-col gap-1">
        <SubStat label="Shared with Customer" value={shared} />
        <SubStat label="Not Shared" value={notShared} valueClass={notShared > 0 ? "text-red-600" : undefined} />
        {notSubmitted !== undefined ? (
          <SubStat
            label="Not Submitted"
            value={notSubmitted}
            valueClass={notSubmitted > 0 ? "text-red-600" : undefined}
          />
        ) : null}
      </div>
    </Card>
  );
}

export function ProjectHealthDashboard() {
  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({});
  const { data, isLoading, isError, error, refetch } = useProjectHealthDashboardSummary(filters);
  const isFiltered = Boolean(filters.geoId || filters.regionId || filters.accountId || filters.projectTypeId);
  // A PM only owns projects — hide every Account- and Geo-level card/filter.
  const effectiveRole = useEffectiveRole();
  const isPm = effectiveRole === "PROJECT_MANAGER";
  // The period each KPI covers, shown at the bottom of its card.
  const weekPeriod = `Selected Period: ${data?.period_label ?? "current week"}`;
  const monthPeriod = `Previous Month: ${data?.previous_month_label ?? "—"}`;
  const asOfToday = "As of today";
  // Geo Delivery Status reports belong to Geo Heads and above.
  const showGeoDeliveryStatus = !isPm && effectiveRole !== "ACCOUNT_MANAGER";
  // Oracle projects with no governance project yet — not for PMs / Team Members.
  const showOracleProjects = useCanSeeOracleProjects();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Project Health</h1>
          <p className="mt-1.5 text-slate-500">
            {isPm ? "Delivery health across your projects" : "Portfolio-wide delivery health across every account and geo"}
          </p>
        </div>
        {data?.period_label ? <p className="text-sm text-slate-400">Period: {data.period_label}</p> : null}
      </header>

      <ProjectHealthFilterBar filters={filters} onChange={setFilters} />

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold">Couldn&apos;t load Project Health.</p>
          <p className="mt-1 text-red-600">
            {error instanceof ApiError ? String(error.detail ?? error.message) : "Something went wrong."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : isLoading || !data ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <SectionHeader
              title={isPm ? "Project" : "Account & Project"}
              icon={FolderOpen}
              className="border-blue-200 bg-blue-50 text-[#1a6fc4]"
            />
          <div className={cn("grid grid-cols-1 gap-4", isPm ? "md:grid-cols-2" : "md:grid-cols-3")}>
            {isPm ? null : (
              <Card
                title="Account Health"
                icon={HeartPulse}
                iconClassName="text-emerald-600"
                href="/project-health/account-rag"
                footerLabel="View Account RAG"
                period={weekPeriod}
              >
                <RagCounts
                  green={data.account_health.green_count}
                  amber={data.account_health.amber_count}
                  potentialRed={data.account_health.potential_red_count}
                  red={data.account_health.red_count}
                  notSubmitted={data.account_health.not_submitted_count}
                />
              </Card>
            )}

            <Card
              title="Project Health"
              icon={HeartPulse}
              iconClassName="text-emerald-600"
              href="/project-health/rag"
              footerLabel="View RAG"
              period={weekPeriod}
            >
              <RagCounts
                green={data.health.green_count}
                amber={data.health.amber_count}
                potentialRed={data.health.potential_red_count}
                red={data.health.red_count}
                notSubmitted={data.health.not_submitted_count}
              />
            </Card>

            <Card
              title="Project Health Assessed by DE"
              icon={ShieldCheck}
              iconClassName="text-[#1a6fc4]"
              href="/project-health/assessments"
              footerLabel="View DE Assessments"
              period={weekPeriod}
            >
              <RagCounts
                green={data.de_assessments.green_count}
                amber={data.de_assessments.amber_count}
                potentialRed={data.de_assessments.potential_red_count}
                red={data.de_assessments.red_count}
                notSubmitted={data.de_assessments.not_assessed_count}
                notLabel="Not Assessed"
              />
            </Card>
          </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader
              title="RAIDO, Alerts & Actions (as of today)"
              icon={ShieldAlert}
              className="border-red-200 bg-red-50 text-red-700"
            />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card title="Risks" icon={AlertTriangle} iconClassName="text-red-600" href="/project-health/risks" period={asOfToday}>
              <BigStat value={data.risks.open_count} label="Open" />
              <div className="flex flex-col gap-1">
                <SubStat label="High/Crit" value={data.risks.high_critical_count} valueClass="text-red-600" />
                <SubStat label="Overdue" value={data.risks.overdue_count} />
                <SubStat label="No Mitigation" value={data.risks.no_mitigation_count} valueClass="text-amber-600" />
              </div>
            </Card>

            <Card title="Issues" icon={Bug} iconClassName="text-amber-500" href="/project-health/issues" period={asOfToday}>
              <BigStat value={data.issues.open_count} label="Open" />
              <div className="flex flex-col gap-1">
                <SubStat label="Critical" value={data.issues.critical_count} valueClass="text-red-600" />
                <SubStat label="Overdue" value={data.issues.overdue_count} />
              </div>
            </Card>

            <Card
              title="Opportunities"
              icon={Lightbulb}
              iconClassName="text-emerald-600"
              href="/project-health/opportunities"
              period={asOfToday}
            >
              <BigStat value={data.opportunities.open_count} label="Open" />
              <div className="flex flex-col gap-1">
                <SubStat
                  label="High Priority"
                  value={data.opportunities.high_priority_count}
                  valueClass="text-emerald-700"
                />
                <SubStat label="Pending Approval" value={data.opportunities.pending_approval_count} />
              </div>
            </Card>

            <Card
              title="DE Alerts"
              icon={Search}
              iconClassName="text-purple-600"
              href="/project-health/findings"
              footerLabel="View Findings"
              period={asOfToday}
            >
              <BigStat value={data.alerts.open_count} label="Open Alerts" />
              <div className="flex flex-col gap-1">
                <SubStat label="Overdue" value={data.alerts.overdue_count} valueClass="text-red-600" />
                <SubStat label="Awaiting Closure" value={data.alerts.awaiting_closure_count} />
              </div>
            </Card>

            <Card title="Actions" icon={ListChecks} iconClassName="text-[#1a6fc4]" href="/project-health/actions" period={asOfToday}>
              <BigStat value={data.actions.open_count} label="Open" />
              <div className="flex flex-col gap-1">
                <SubStat label="In Progress" value={data.actions.in_progress_count} />
                <SubStat label="Overdue" value={data.actions.overdue_count} valueClass="text-red-600" />
              </div>
              {isFiltered ? (
                <p className="mt-3 text-[11px] text-slate-400">
                  Geo/Account-level actions are excluded while a filter is active.
                </p>
              ) : null}
            </Card>
          </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader
              title="Performance & Commercial"
              icon={BarChart3}
              className="border-indigo-200 bg-indigo-50 text-indigo-700"
            />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card
              title="Metrics"
              icon={BarChart3}
              iconClassName="text-[#1a6fc4]"
              href="/project-health/metrics"
              period={monthPeriod}
            >
              <BigStat
                value={data.metrics.compliant_count}
                label="Compliant Projects"
                valueClass="text-emerald-600"
              />
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <span className="text-sm font-medium text-red-700">Critical Variance</span>
                  <span className="font-bold text-red-700">{data.metrics.critical_variance_count}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">Not Reported</span>
                  <span className="font-bold text-slate-900">{data.metrics.not_reported_count}</span>
                </div>
              </div>
            </Card>

            <Card
              title="Commitments"
              icon={Handshake}
              iconClassName="text-teal-600"
              href="/project-health/commitments"
              period={monthPeriod}
            >
              <BigStat value={data.commitments.met_count} label="Met Projects" valueClass="text-emerald-600" />
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <span className="text-sm font-medium text-red-700">Not Met</span>
                  <span className="font-bold text-red-700">{data.commitments.not_met_count}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">Not Reported</span>
                  <span className="font-bold text-slate-900">{data.commitments.not_reported_count}</span>
                </div>
              </div>
            </Card>

            <Card
              title="Payment Milestones"
              icon={Wallet}
              iconClassName="text-emerald-600"
              href="/project-health/payment-milestones"
              period={asOfToday}
            >
              <BigStat
                value={formatNumber(data.payment_milestones.value_due)}
                label="Value Due"
                valueClass="text-emerald-600"
              />
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">Due</span>
                  <span className="font-bold text-slate-900">{data.payment_milestones.due_count}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <span className="text-sm font-medium text-red-700">Overdue</span>
                  <span className="font-bold text-red-700">{data.payment_milestones.overdue_count}</span>
                </div>
              </div>
            </Card>
          </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader
              title="Delivery Status"
              icon={ClipboardCheck}
              className="border-slate-200 bg-slate-50 text-slate-600"
            />
            <p className="text-xs text-slate-400">
              The selected week&apos;s weekly Delivery Status report. Draft reports count as Not Submitted.
            </p>
            <div className={cn("grid grid-cols-1 gap-4", showGeoDeliveryStatus ? "md:grid-cols-3" : "md:grid-cols-2")}>
              <ReportSubmissionCard
                title="Delivery Status — Projects"
                kpi={data.report_submissions.delivery_status_projects}
                href={REPORT_SUBMISSION_STREAMS["delivery-status-projects"].route}
                period={weekPeriod}
                variant="approval"
              />
              {isPm ? null : (
                <>
                  <ReportSubmissionCard
                    title="Delivery Status — Account"
                    kpi={data.report_submissions.delivery_status_accounts}
                    href={REPORT_SUBMISSION_STREAMS["delivery-status-account"].route}
                    period={weekPeriod}
                    variant="approval"
                  />
                  {showGeoDeliveryStatus ? (
                    <ReportSubmissionCard
                      title="Delivery Status — Geo"
                      kpi={data.report_submissions.delivery_status_geos}
                      href={REPORT_SUBMISSION_STREAMS["delivery-status-geo"].route}
                      period={weekPeriod}
                      variant="baseline"
                    />
                  ) : null}
                </>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader
              title="Project Performance & Customer Reporting"
              icon={Users}
              className="border-slate-200 bg-slate-50 text-slate-600"
            />
            <p className="text-xs text-slate-400">
              {isPm
                ? "Project Performance is the monthly report for the month before the selected week. Customer Project Status Reporting covers the selected week."
                : "Project Performance is the monthly report for the month before the selected week. Customer Project Status Reporting covers the selected week; Customer Account Reporting covers the previous and the current calendar quarter, as it is shared quarterly (accounts with no entry in either count as Not Shared)."}
            </p>
            <div className={cn("grid grid-cols-1 gap-4", isPm ? "md:grid-cols-2" : "md:grid-cols-3")}>
              <ReportSubmissionCard
                title="Project Performance"
                kpi={data.report_submissions.project_performance}
                href={REPORT_SUBMISSION_STREAMS["metrics-projects"].route}
                period={monthPeriod}
              />

              <CustomerReportCard
                title="Customer Project Status Reporting"
                href="/project-health/customer-project-reports"
                period={weekPeriod}
                shared={data.customer_project_reports.shared_count}
                notShared={data.customer_project_reports.not_shared_count}
                notSubmitted={data.customer_project_reports.not_submitted_count}
              />

              {isPm ? null : (
                <CustomerReportCard
                  title="Customer Account Reporting"
                  href="/project-health/customer-account-reports"
                  period="Previous & current quarter"
                  shared={data.customer_account_reports.shared_count}
                  notShared={data.customer_account_reports.not_shared_count}
                />
              )}
            </div>
          </section>

          {showOracleProjects ? (
            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Oracle Projects"
                icon={Database}
                className="border-slate-200 bg-slate-50 text-slate-600"
              />
              <p className="text-xs text-slate-400">
                Oracle projects that no governance project has been created for.
                {effectiveRole === "GEO_HEAD"
                  ? " Shows your geos' projects and those with no GEO."
                  : effectiveRole === "ACCOUNT_MANAGER"
                    ? " Shows your accounts' projects."
                    : ""}
              </p>
              <ProjectHealthOracleProjectsSection filters={filters} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
