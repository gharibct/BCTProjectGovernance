"use client";

import * as React from "react";
import {
  AlertTriangle,
  BarChart3,
  Bug,
  Database,
  FolderOpen,
  GitBranch,
  Handshake,
  HeartPulse,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useProjectHealthDashboardSummary, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BigStat, Card, SubStat } from "./project-health-kpi";

// Project Health dashboard (design-reference/Project-Health.html) — an
// org-wide, portfolio-level KPI page for PMO/Admin/CXO. Restyled to this
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

// Compact Green/Amber/Pot. Red/Red/Overdue count strip shared by the Project
// Health and Account Health cards — kept small so all three cards sit in one row.
function RagCounts({
  green,
  amber,
  potentialRed,
  red,
  overdue,
}: {
  green: React.ReactNode;
  amber: React.ReactNode;
  potentialRed: React.ReactNode;
  red: React.ReactNode;
  overdue: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-5 gap-1">
      <RagCell label="Green" value={green} className="border-emerald-100 bg-emerald-50 text-emerald-700" valueClassName="text-emerald-600" />
      <RagCell label="Amber" value={amber} className="border-amber-100 bg-amber-50 text-amber-700" valueClassName="text-amber-500" />
      <RagCell label="Pot. Red" value={potentialRed} className="border-orange-100 bg-orange-50 text-orange-700" valueClassName="text-orange-600" />
      <RagCell label="Red" value={red} className="border-red-100 bg-red-50 text-red-700" valueClassName="text-red-600" />
      <RagCell label="Overdue" value={overdue} className="border-slate-200 bg-slate-50 text-slate-500" valueClassName="text-slate-900" />
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

export function ProjectHealthDashboard() {
  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({});
  const { data, isLoading, isError, error, refetch } = useProjectHealthDashboardSummary(filters);
  const isFiltered = Boolean(filters.geoId || filters.accountId || filters.projectTypeId);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Project Health</h1>
          <p className="mt-1.5 text-slate-500">Portfolio-wide delivery health across every account and geo</p>
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
              title="Project & Account"
              icon={FolderOpen}
              className="border-blue-200 bg-blue-50 text-[#1a6fc4]"
            />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card
              title="Project Portfolio"
              icon={FolderOpen}
              iconClassName="text-[#1a6fc4]"
              href="/project-health/project-list"
              footerLabel="View Project List"
            >
              <div className="flex items-end justify-between">
                <BigStat value={data.portfolio.total_count} label="Total" />
                <div className="flex flex-col gap-1 pb-3 text-right">
                  <SubStat label="Active" value={data.portfolio.active_count} />
                  <SubStat label="Completed" value={data.portfolio.completed_count} />
                </div>
              </div>
            </Card>

            <Card
              title="Project Health"
              icon={HeartPulse}
              iconClassName="text-emerald-600"
              href="/project-health/rag"
              footerLabel="View RAG"
            >
              <RagCounts
                green={data.health.green_count}
                amber={data.health.amber_count}
                potentialRed={data.health.potential_red_count}
                red={data.health.red_count}
                overdue={data.health.reporting_overdue_count}
              />
            </Card>

            <Card
              title="Account Health"
              icon={HeartPulse}
              iconClassName="text-emerald-600"
              href="/project-health/account-rag"
              footerLabel="View Account RAG"
            >
              <RagCounts
                green={data.account_health.green_count}
                amber={data.account_health.amber_count}
                potentialRed={data.account_health.potential_red_count}
                red={data.account_health.red_count}
                overdue={data.account_health.reporting_overdue_count}
              />
            </Card>
          </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader
              title="RAIDO"
              icon={ShieldAlert}
              className="border-red-200 bg-red-50 text-red-700"
            />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card title="Risks" icon={AlertTriangle} iconClassName="text-red-600" href="/project-health/risks">
              <BigStat value={data.risks.open_count} label="Open" />
              <div className="flex flex-col gap-1">
                <SubStat label="High/Crit" value={data.risks.high_critical_count} valueClass="text-red-600" />
                <SubStat label="Overdue" value={data.risks.overdue_count} />
                <SubStat label="No Mitigation" value={data.risks.no_mitigation_count} valueClass="text-amber-600" />
              </div>
            </Card>

            <Card title="Issues" icon={Bug} iconClassName="text-amber-500" href="/project-health/issues">
              <BigStat value={data.issues.open_count} label="Open" />
              <div className="flex flex-col gap-1">
                <SubStat label="Critical" value={data.issues.critical_count} valueClass="text-red-600" />
                <SubStat label="Overdue" value={data.issues.overdue_count} />
              </div>
            </Card>

            <Card title="Dependencies" icon={GitBranch} iconClassName="text-purple-600" href="/project-health/dependencies">
              <BigStat value={data.dependencies.open_count} label="Open" />
              <div className="flex flex-col gap-1">
                <SubStat label="Overdue" value={data.dependencies.overdue_count} />
                <SubStat label="Critical" value={data.dependencies.critical_count} valueClass="text-red-600" />
              </div>
            </Card>

            <Card title="Assumptions" icon={HelpCircle} iconClassName="text-blue-600" href="/project-health/assumptions">
              <BigStat value={data.assumptions.open_count} label="Open" />
              <div className="flex flex-col gap-1">
                <SubStat label="Review Due" value={data.assumptions.review_due_count} valueClass="text-amber-600" />
                <SubStat label="Overdue" value={data.assumptions.overdue_count} valueClass="text-red-600" />
              </div>
            </Card>

            <Card
              title="Opportunities"
              icon={Lightbulb}
              iconClassName="text-emerald-600"
              href="/project-health/opportunities"
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
          </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader
              title="Performance & Commercial"
              icon={BarChart3}
              className="border-indigo-200 bg-indigo-50 text-indigo-700"
            />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card title="Metrics" icon={BarChart3} iconClassName="text-[#1a6fc4]" href="/project-health/metrics">
              <div className="mb-3 flex items-center gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-4 border-emerald-500">
                  <span className="text-lg font-bold text-emerald-700">{data.metrics.compliant_pct}%</span>
                </div>
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Compliant</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xl font-bold text-amber-600">{data.metrics.below_target_count}</p>
                  <p className="text-[10px] tracking-wide text-slate-500 uppercase">Below Target</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xl font-bold text-slate-500">{data.metrics.not_reported_count}</p>
                  <p className="text-[10px] tracking-wide text-slate-500 uppercase">Not Reported</p>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-2">
                  <p className="text-[10px] font-semibold tracking-wide text-red-700 uppercase">Critical Variance</p>
                  <p className="text-xl font-bold text-red-700">{data.metrics.critical_variance_count}</p>
                </div>
              </div>
            </Card>

            <Card title="Commitments" icon={Handshake} iconClassName="text-teal-600" href="/project-health/commitments">
              <BigStat value={data.commitments.open_count} label="Open Commitments" />
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                  <span className="text-sm font-medium text-amber-700">Due Soon</span>
                  <span className="font-bold text-amber-700">{data.commitments.due_soon_count}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <span className="text-sm font-medium text-red-700">Overdue</span>
                  <span className="font-bold text-red-700">{data.commitments.overdue_count}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-100 px-3 py-2">
                  <span className="text-sm font-medium text-red-800">Breached</span>
                  <span className="font-bold text-red-800">{data.commitments.breached_count}</span>
                </div>
              </div>
            </Card>

            <Card
              title="Payment Milestones"
              icon={Wallet}
              iconClassName="text-emerald-600"
              href="/project-health/payment-milestones"
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
              title="Delivery Excellence & Governance"
              icon={ShieldCheck}
              className="border-emerald-200 bg-emerald-50 text-emerald-700"
            />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card title="Findings" icon={Search} iconClassName="text-purple-600" href="/project-health/findings">
              <BigStat value={data.findings.open_count} label="Open Findings" />
              <div className="flex flex-col gap-1">
                <SubStat
                  label="New This Period"
                  value={data.findings.new_this_period_count}
                  valueClass="text-purple-600"
                />
                <SubStat label="Overdue" value={data.findings.overdue_count} valueClass="text-red-600" />
                <SubStat label="Awaiting Closure" value={data.findings.awaiting_closure_count} />
              </div>
            </Card>

            <Card
              title="DE Assessments"
              icon={ShieldCheck}
              iconClassName="text-[#1a6fc4]"
              href="/project-health/assessments"
            >
              <div className="mb-3 flex items-end justify-between">
                <BigStat value={data.de_assessments.completed_count} label="Completed" />
                <div className="pb-3 text-right">
                  <p className="text-[10px] tracking-wide text-slate-400 uppercase">Avg PCI</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {data.de_assessments.avg_pci_score ? `${data.de_assessments.avg_pci_score}%` : "—"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <SubStat label="Due" value={data.de_assessments.due_count} />
                <SubStat label="Red/Amber" value={data.de_assessments.red_amber_count} valueClass="text-red-600" />
              </div>
            </Card>

            <Card title="Actions" icon={ListChecks} iconClassName="text-[#1a6fc4]" href="/project-health/actions">
              <BigStat value={data.actions.open_count} label="Open" />
              <div className="flex flex-col gap-1">
                <SubStat label="In Progress" value={data.actions.in_progress_count} />
                <SubStat label="Overdue" value={data.actions.overdue_count} valueClass="text-red-600" />
                <SubStat label="Due This Week" value={data.actions.due_this_week_count} valueClass="text-amber-600" />
              </div>
              {isFiltered ? (
                <p className="mt-3 text-[11px] text-slate-400">
                  Geo/Account-level actions are excluded while a filter is active.
                </p>
              ) : null}
            </Card>

            <Card
              title="Data Integrity"
              icon={Database}
              iconClassName="text-slate-500"
              href="/project-health/data-integrity"
            >
              <BigStat
                value={`${data.data_integrity.overall_compliance_pct}%`}
                label="Overall Compliance"
                valueClass="text-emerald-600"
              />
              <div className="flex flex-col gap-1">
                <SubStat
                  label="Projects With Gaps"
                  value={data.data_integrity.projects_with_gaps_count}
                  valueClass="text-amber-600"
                />
                <SubStat
                  label="Critical Gaps"
                  value={data.data_integrity.critical_gaps_count}
                  valueClass="text-red-600"
                />
              </div>
            </Card>
          </div>
          </section>
        </>
      )}
    </div>
  );
}
