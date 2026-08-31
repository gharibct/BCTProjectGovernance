"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardCheck, FileEdit, ListChecks } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useGeos } from "@/lib/api/reference-data";
import { useSession } from "@/stores/session";
import { NativeSelect } from "@/components/ui/native-select";
import { useGeoHeadDashboardSummary } from "@/lib/api/geo-head-dashboard";
import type { HealthRating } from "@/lib/api/projects";
import { GeoHeadAccountReviewQueue } from "./geo-head-account-review-queue";
import { AccountHeadPortfolioHealth } from "./account-head-portfolio-health";

// Geo Head "My Summary" (design-reference/geohead-mysummary.jpg) — the
// GEO_HEAD role's counterpart to account-head-my-summary.tsx, one tier up:
// scoped to the signed-in user's owned geo(s) (user_geos) rather than owned
// accounts. The geo selector re-scopes the whole page, same idiom
// dashboard-view.tsx uses for its Geo/Account selector.

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

const GEO_HEALTH_TEXT_CLASS: Record<HealthRating, string> = {
  Red: "text-red-600",
  "Potential Red": "text-red-600",
  Amber: "text-amber-500",
  Green: "text-emerald-600",
};

export function GeoHeadMySummary() {
  const ownedGeoIds = useSession((s) => s.user?.geo_ids ?? []);
  const { data: geos = [] } = useGeos();
  const options = geos.filter((g) => ownedGeoIds.includes(g.id));

  const [selectedGeoId, setSelectedGeoId] = React.useState("");
  const effectiveGeoId = selectedGeoId || null;
  const linkGeoId = selectedGeoId || options[0]?.id;

  const { data, isLoading, isError, error, refetch } = useGeoHeadDashboardSummary(effectiveGeoId);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Summary</h1>
        </div>
        {options.length > 0 ? (
          <div className="w-56">
            <NativeSelect
              aria-label="Geo Selection"
              className="h-10 bg-white text-sm"
              value={selectedGeoId}
              onChange={(e) => setSelectedGeoId(e.target.value)}
            >
              <option value="">All Geos</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
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
            <StatCard label="Projects" value={data.projects_count} />
            <StatCard
              label="Geo Health"
              value={
                data.geo_health ? (
                  <span className={GEO_HEALTH_TEXT_CLASS[data.geo_health]}>{data.geo_health.toUpperCase()}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )
              }
            />
            <StatCard label="Awaiting Review" value={data.awaiting_review_count} accent="red" />
            <StatCard
              label="Geo Report"
              value={
                data.geo_report_due ? (
                  <span className="flex items-center gap-1.5 text-red-600">
                    <AlertTriangle className="size-6" />
                    DUE
                  </span>
                ) : (
                  <span className="text-emerald-600">Submitted</span>
                )
              }
              accent={data.geo_report_due ? "red" : undefined}
            />
            <StatCard label="Open Actions" value={data.open_actions_count} />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-6">
              <GeoHeadAccountReviewQueue rows={data.account_review_queue} />
              <AccountHeadPortfolioHealth rows={data.account_portfolio_health} />
            </div>

            <div className="flex flex-col gap-6">
              {data.critical_attention.length > 0 ? (
                <section className="rounded-xl border border-red-200 bg-red-50">
                  <h2 className="flex items-center gap-2 border-b border-red-200 px-5 py-3 text-sm font-bold text-red-700">
                    <AlertTriangle className="size-4" />
                    Critical Attention
                  </h2>
                  <ul className="divide-y divide-red-100 px-2 py-2">
                    {data.critical_attention.map((item, index) => (
                      <li key={index}>
                        <Link
                          href={item.href}
                          className="flex flex-col gap-0.5 rounded-lg px-3 py-3 hover:bg-white/60"
                        >
                          <span className="text-sm font-bold text-red-700">{item.category}</span>
                          <span className="text-sm text-slate-600">{item.subtitle}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 font-bold text-slate-900">
                  <ClipboardCheck className="size-4" />
                  Geo Reporting Readiness
                </h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-900">{data.reporting_readiness.ready_count}</span>
                  <span className="text-slate-400">/ {data.reporting_readiness.total_count} Accounts Ready</span>
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
                {linkGeoId ? (
                  <Link
                    href={`/geo-reporting/${linkGeoId}`}
                    className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-[#1a6fc4] hover:underline"
                  >
                    Go to Geo Reporting →
                  </Link>
                ) : null}
              </section>

              {data.executive_update ? (
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="flex items-center justify-between gap-2 font-bold text-slate-900">
                    <span className="flex items-center gap-2">
                      <FileEdit className="size-4" />
                      Executive Update
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tracking-wide text-slate-600 uppercase">
                      {data.executive_update.status}
                    </span>
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">{data.executive_update.description}</p>
                  <Link
                    href={data.executive_update.href}
                    className="mt-3 flex items-center justify-center gap-1 rounded-md bg-[#1a6fc4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a6fc4]/90"
                  >
                    Continue Update →
                  </Link>
                </section>
              ) : null}

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
