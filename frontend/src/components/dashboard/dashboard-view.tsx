"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/native-select";
import { useAccounts, useGeos } from "@/lib/api/reference-data";
import { useDashboardSummary, type DashboardScope } from "@/lib/api/dashboard";
import { GovernanceMatrix } from "./governance-matrix";
import { TopHighlights } from "./top-highlights";

function KpiCard({ label, value, hint, valueClass }: { label: string; value: number; hint: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</div>
      <div className={cn("mt-1 text-3xl font-bold text-slate-900", valueClass)}>{value}</div>
      <div className="mt-1 text-sm text-slate-400">{hint}</div>
    </div>
  );
}

// Reusable dashboard for the role-specific screens (Admin/CXO unfiltered,
// Account Manager/Geo Head pre-filtered by their mapped account(s)/geo(s)) —
// backed by the real /dashboard/summary aggregation, unlike the sample-data
// "My Summary" page (dashboard.tsx) at /dashboard.
//
// `rowScope` picks which Governance Matrix/Highlights the page shows one
// level of the org hierarchy: "account" (CXO/Admin/Geo Head — matrix rows
// are Accounts, selector narrows by Geo) or "project" (Account Manager —
// matrix rows are Projects, selector narrows by Account).
export function DashboardView({
  title,
  subtitle,
  scope,
  rowScope,
}: {
  title: string;
  subtitle: string;
  scope: DashboardScope;
  rowScope: "account" | "project";
}) {
  const { data: geos = [] } = useGeos();
  const { data: accounts = [] } = useAccounts();

  // Selector options are the role's own base scope narrowed down one level
  // (Geo Head only ever sees their own geos, Account Manager only their own
  // accounts) — CXO/Admin pass an unrestricted base scope, so they see every
  // geo. Same restriction convention as app-sidebar.tsx's reportingGeos.
  const options =
    rowScope === "account"
      ? scope.geo_ids !== undefined
        ? geos.filter((g) => scope.geo_ids!.includes(g.id))
        : geos
      : scope.account_ids !== undefined
        ? accounts.filter((a) => scope.account_ids!.includes(a.id))
        : accounts;

  const [selectedId, setSelectedId] = React.useState("");

  // Selecting an option re-scopes the whole dashboard for this render — one
  // effective scope drives the single useDashboardSummary call below (KPIs,
  // matrix, compliance, milestones, and highlights all together).
  const effectiveScope: DashboardScope = selectedId
    ? rowScope === "account"
      ? { geo_ids: [selectedId] }
      : { account_ids: [selectedId] }
    : scope;

  // An empty (but present) geo_ids/account_ids array means "this user owns
  // zero geos/accounts" — that must show nothing, not fall through to an
  // unfiltered (everything) query, since an empty query param list is
  // indistinguishable from an omitted one on the wire.
  const isEmptyScope =
    (effectiveScope.account_ids !== undefined && effectiveScope.account_ids.length === 0) ||
    (effectiveScope.geo_ids !== undefined && effectiveScope.geo_ids.length === 0);
  const { data, isLoading } = useDashboardSummary(effectiveScope, { enabled: !isEmptyScope });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1.5 text-slate-500">{subtitle}</p>
        </div>
        {options.length > 0 ? (
          <div className="w-56">
            <NativeSelect
              aria-label={rowScope === "account" ? "Geo Selection" : "Account Selection"}
              className="h-10 bg-white text-sm"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">{rowScope === "account" ? "All Geos" : "All Accounts"}</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </header>

      {isEmptyScope ? (
        <p className="text-slate-400">
          No accounts or geos are assigned to you yet — contact your Admin.
        </p>
      ) : isLoading || !data ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
            <KpiCard label="Active Projects" value={data.active_projects} hint="Currently in flight" />
            <KpiCard
              label="Delayed Projects"
              value={data.delayed_projects}
              hint="Past planned end date"
              valueClass="text-red-600"
            />
            <KpiCard label="Open Risks" value={data.open_risks} hint="Open or monitoring" />
            <KpiCard label="Open Issues" value={data.open_issues} hint="Not yet resolved" />
            <KpiCard label="Pending Approvals" value={data.pending_approvals} hint="Opportunities + DE alerts" />
          </div>

          <GovernanceMatrix
            heading={rowScope === "account" ? "Account Governance Matrix" : "Project Governance Matrix"}
            entityColumnLabel={rowScope === "account" ? "Accounts" : "Projects"}
            showAccountColumn={rowScope === "project"}
            rows={rowScope === "account" ? data.account_matrix : data.project_matrix}
            entityHref={(id) => (rowScope === "account" ? `/account-review/${id}` : `/project-review/${id}`)}
            emptyLabel={rowScope === "account" ? "No accounts in scope." : "No projects in scope."}
          />

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-900">Contractual Compliance</h2>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div>
                  <dt className="text-xs font-bold tracking-wide text-slate-500 uppercase">Met</dt>
                  <dd className="mt-1 text-2xl font-bold text-emerald-600">
                    {data.contractual_compliance.met_count}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold tracking-wide text-slate-500 uppercase">Not Met</dt>
                  <dd className="mt-1 text-2xl font-bold text-red-600">
                    {data.contractual_compliance.not_met_count}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold tracking-wide text-slate-500 uppercase">Not Recorded</dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-500">
                    {data.contractual_compliance.not_yet_recorded_count}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-900">Milestone Payments</h2>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div>
                  <dt className="text-xs font-bold tracking-wide text-slate-500 uppercase">Upcoming</dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-900">
                    {data.milestone_payments.upcoming_count}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold tracking-wide text-slate-500 uppercase">Overdue</dt>
                  <dd className="mt-1 text-2xl font-bold text-red-600">
                    {data.milestone_payments.overdue_count}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold tracking-wide text-slate-500 uppercase">Paid</dt>
                  <dd className="mt-1 text-2xl font-bold text-emerald-600">
                    {data.milestone_payments.paid_count}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <TopHighlights items={rowScope === "account" ? data.account_highlights : data.project_highlights} />
        </>
      )}
    </div>
  );
}
