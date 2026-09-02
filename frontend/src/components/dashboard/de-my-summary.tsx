"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardList } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useDeDashboardSummary } from "@/lib/api/de-dashboard";
import { DeAssessmentWorkQueue } from "./de-assessment-work-queue";

// Delivery Excellence "My Summary" (design-reference/de-mysummary.jpg) — the
// DELIVERY_EXCELLENCE role's counterpart to account-head-my-summary.tsx,
// scoped to projects where the signed-in user is Project.delivery_excellence_id.
// A DE assessment is independent of reporting periods — everything here is for
// the current calendar month (see backend's current_month_window).

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: "red";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm",
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

export function DeMySummary() {
  const { data, isLoading, isError, error, refetch } = useDeDashboardSummary();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Summary</h1>
        <p className="text-sm text-slate-400">Delivery Excellence</p>
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
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
            <StatCard label="Assessments Due" value={data.assessments_due_count} />
            <StatCard
              label="Completed"
              value={
                <span className="flex items-baseline gap-1">
                  <span className="text-emerald-600">{data.completion.completed_count}</span>
                  <span className="text-lg text-slate-400">/ {data.completion.total_count}</span>
                </span>
              }
            />
            <StatCard label="Red/Amber Assessed" value={data.red_amber_assessed_count} />
            <StatCard label="Open Findings" value={data.findings.open_count} />
            <StatCard label="Overdue Findings" value={data.findings.overdue_count} accent="red" />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
            <DeAssessmentWorkQueue rows={data.work_queue} />

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
                  <ClipboardList className="size-4" />
                  Findings Summary
                </h2>
                <ul className="mt-3 flex flex-col divide-y divide-slate-100 text-sm">
                  <li className="flex items-center justify-between py-2">
                    <span className="text-slate-600">Open Findings</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                      {data.findings.open_count}
                    </span>
                  </li>
                  <li className="flex items-center justify-between py-2">
                    <span className="text-slate-600">Overdue Findings</span>
                    <span className="rounded-md bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                      {data.findings.overdue_count}
                    </span>
                  </li>
                  <li className="flex items-center justify-between py-2">
                    <span className="text-slate-600">New This Month</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                      {data.findings.new_this_period_count}
                    </span>
                  </li>
                  <li className="flex items-center justify-between py-2">
                    <span className="text-slate-600">Closed This Month</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                      {data.findings.closed_this_period_count}
                    </span>
                  </li>
                </ul>

                {data.findings.by_classification.length > 0 ? (
                  <div className="mt-4">
                    <div className="text-xs font-bold tracking-wide text-slate-500 uppercase">By Classification</div>
                    <ul className="mt-2 flex flex-col gap-3">
                      {data.findings.by_classification.map((row) => {
                        const pct =
                          data.findings.open_count > 0
                            ? Math.round((row.count / data.findings.open_count) * 100)
                            : 0;
                        return (
                          <li key={row.classification}>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-600">{row.classification}</span>
                              <span className="font-semibold text-slate-700">
                                {pct}% ({row.count})
                              </span>
                            </div>
                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-[#1a6fc4]" style={{ width: `${pct}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
