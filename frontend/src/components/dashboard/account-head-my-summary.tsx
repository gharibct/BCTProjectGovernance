"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardCheck, ListChecks } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useAccountHeadDashboardSummary } from "@/lib/api/account-head-dashboard";
import { AccountHeadReportReviewQueue } from "./account-head-report-review-queue";
import { AccountHeadPortfolioHealth } from "./account-head-portfolio-health";

// Account Head "My Summary" (design-reference/acchead-mysummary.jpg) — the
// ACCOUNT_MANAGER role's counterpart to pm-my-summary.tsx: same real,
// /dashboard/account-head-summary-backed landing page, replacing the old
// generic DashboardView(scope: account_ids) previously used at
// /dashboard/account-manager.

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: "amber" | "red";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm",
        accent === "amber" && "border-l-4 border-l-amber-400",
        accent === "red" && "border border-red-200 bg-red-50"
      )}
    >
      <div
        className={cn(
          "text-xs font-bold tracking-wide uppercase",
          accent === "red" ? "text-red-700" : "text-slate-500"
        )}
      >
        {label}
      </div>
      <div className={cn("mt-1 text-3xl font-bold", accent === "red" ? "text-red-700" : "text-slate-900")}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-sm text-slate-400">{hint}</div> : null}
    </div>
  );
}

export function AccountHeadMySummary() {
  const { data, isLoading, isError, error, refetch } = useAccountHeadDashboardSummary();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Summary</h1>
        <p className="text-sm text-slate-400">My Accounts</p>
      </header>

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold">Couldn&apos;t load your summary.</p>
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
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
            <StatCard label="Accounts" value={data.accounts_count} />
            <StatCard label="Active Projects" value={data.active_projects_count} />
            <StatCard
              label="Project Health"
              value={
                <span className="flex items-baseline gap-3">
                  <span className="text-emerald-600">{data.health_green}</span>
                  <span className="text-amber-500">{data.health_amber}</span>
                  <span className="text-orange-600">{data.health_potential_red}</span>
                  <span className="text-red-600">{data.health_red}</span>
                </span>
              }
            />
            <StatCard label="Awaiting Review" value={data.awaiting_review_count} accent="red" />
            <StatCard label="High/Critical Risks" value={data.high_critical_risks_count} accent="amber" />
            <StatCard
              label="Open Actions"
              value={
                <span className="flex items-baseline gap-3">
                  <span className="text-blue-900">{data.open_actions_high}</span>
                  <span className="text-blue-600">{data.open_actions_medium}</span>
                  <span className="text-blue-400">{data.open_actions_low}</span>
                </span>
              }
            />
          </div>

          <AccountHeadReportReviewQueue rows={data.report_review_queue} />

          <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
            <AccountHeadPortfolioHealth rows={data.account_portfolio_health} />

            <div className="flex flex-col gap-6">
              {data.attention_items.length > 0 ? (
                <section className="rounded-xl border border-red-200 bg-red-50">
                  <h2 className="flex items-center gap-2 border-b border-red-200 px-5 py-3 text-sm font-bold text-red-700">
                    <AlertTriangle className="size-4" />
                    Attention Required
                  </h2>
                  <ul className="divide-y divide-red-100 px-2 py-2">
                    {data.attention_items.map((item, index) => (
                      <li key={index}>
                        <Link
                          href={item.href}
                          className="flex items-center justify-between gap-4 rounded-lg px-3 py-3 hover:bg-white/60"
                        >
                          <span>
                            <span className="block font-semibold text-slate-900">{item.title}</span>
                            <span className="block text-sm text-slate-500">{item.subtitle}</span>
                          </span>
                          <span className="text-slate-400">›</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 font-bold text-slate-900">
                  <ClipboardCheck className="size-4" />
                  Account Reporting Readiness
                </h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-900">{data.reporting_readiness.ready_count}</span>
                  <span className="text-slate-400">/ {data.reporting_readiness.total_count} Projects Ready</span>
                </div>
                <ul className="mt-3 flex flex-col gap-1 text-sm text-slate-600">
                  <li>{data.reporting_readiness.approved_count} Approved</li>
                  <li>{data.reporting_readiness.awaiting_review_count} Awaiting My Review</li>
                  <li>{data.reporting_readiness.not_submitted_count} Not Submitted</li>
                  <li>{data.reporting_readiness.rejected_count} Rejected</li>
                </ul>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#1a6fc4]"
                    style={{
                      width:
                        data.reporting_readiness.total_count > 0
                          ? `${Math.round(
                              (data.reporting_readiness.ready_count / data.reporting_readiness.total_count) * 100
                            )}%`
                          : "0%",
                    }}
                  />
                </div>
                {data.account_portfolio_health.length > 0 ? (
                  <Link
                    href={`/account-reporting/${data.account_portfolio_health[0].account_id}`}
                    className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-[#1a6fc4] hover:underline"
                  >
                    Go to Account Reporting →
                  </Link>
                ) : null}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 font-bold text-slate-900">
                  <ListChecks className="size-4" />
                  My Actions
                </h2>
                {data.open_actions.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">No open actions assigned to you.</p>
                ) : (
                  <ul className="mt-3 flex flex-col divide-y divide-slate-100">
                    {data.open_actions.map((action) => (
                      <li key={action.id} className="py-3 first:pt-0 last:pb-0">
                        <Link href={action.href} className="flex flex-col gap-0.5 hover:underline">
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-semibold text-slate-900">{action.title}</span>
                            {action.overdue ? (
                              <span className="shrink-0 rounded-md bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-200">
                                OVERDUE
                              </span>
                            ) : action.due_this_week ? (
                              <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
                                DUE THIS WK
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between text-sm text-slate-500">
                            <span>{action.entity_label}</span>
                            <span>
                              {new Date(action.due_date).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
