"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, FolderOpen, ListChecks } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useMyDashboardSummary } from "@/lib/api/pm-dashboard";
import { PmMyProjectsHealthTable } from "./pm-my-projects-health-table";

// PM "My Summary" (design-reference/pm-mysummary.jpg) — the real,
// /dashboard/my-summary-backed replacement for the PM's landing page.
// Deliberately a new component/route rather than an edit to dashboard.tsx
// (the old /dashboard, still sample-data-driven and still used by
// Team Member/Delivery Excellence/PMO).

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: "amber";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm",
        accent === "amber" && "border-l-4 border-l-amber-400"
      )}
    >
      <div className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</div>
      <div className="mt-1 text-3xl font-bold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-sm text-slate-400">{hint}</div> : null}
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function PmMySummary() {
  const { data, isLoading, isError, error, refetch } = useMyDashboardSummary();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Summary</h1>
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
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              label="My Projects"
              value={data.my_projects_count}
              hint={
                data.projects_requiring_attention > 0 ? (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="size-3.5" />
                    {data.projects_requiring_attention} require attention
                  </span>
                ) : (
                  "All on track"
                )
              }
            />
            <StatCard
              label="Health Split"
              value={
                <span className="flex items-baseline gap-3">
                  <span className="text-emerald-600">{data.health_green}</span>
                  <span className="text-amber-500">{data.health_amber}</span>
                  <span className="text-red-600">{data.health_red}</span>
                </span>
              }
            />
            <StatCard
              label="Reports Due"
              value={data.reports_due.due_count}
              hint={
                data.reports_due.overdue_count > 0 ? (
                  <span className="text-red-600">{data.reports_due.overdue_count} Overdue</span>
                ) : (
                  "None overdue"
                )
              }
            />
            <StatCard
              label="Open Actions"
              value={
                <span className="flex items-baseline gap-3">
                  <span className="text-blue-900">{data.open_actions_high}</span>
                  <span className="text-blue-600">{data.open_actions_medium}</span>
                  <span className="text-blue-400">{data.open_actions_low}</span>
                </span>
              }
              hint={
                <span className="flex gap-3 text-xs">
                  <span>HIGH</span>
                  <span>MEDIUM</span>
                  <span>LOW</span>
                </span>
              }
            />
          </div>

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

          <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
            <PmMyProjectsHealthTable rows={data.project_health} />

            <div className="flex flex-col gap-6">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 font-bold text-slate-900">
                  <FolderOpen className="size-4" />
                  RAIDO
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-semibold text-slate-500">Open Risks</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{data.raido.open_risks}</div>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="text-xs font-semibold text-red-700">High/Critical</div>
                    <div className="mt-1 text-2xl font-bold text-red-600">{data.raido.high_critical_risks}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-semibold text-slate-500">Open Issues</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{data.raido.open_issues}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-semibold text-slate-500">Dependencies</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{data.raido.dependencies}</div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 font-bold text-slate-900">
                  <ListChecks className="size-4" />
                  My Open Actions
                </h2>
                {data.open_actions.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">No open actions assigned to you.</p>
                ) : (
                  <ul className="mt-3 flex flex-col divide-y divide-slate-100">
                    {data.open_actions.map((action) => (
                      <li key={action.id} className="py-3 first:pt-0 last:pb-0">
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
                        <div className="mt-0.5 flex items-center justify-between text-sm text-slate-500">
                          <span>{action.project_label}</span>
                          <span>{formatDate(action.due_date)}</span>
                        </div>
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
