"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { useDeAccountAuditQueue, type AccountAuditStatus } from "@/lib/api/de-account-audit";
import { formatGeoRegion } from "@/lib/api/project-health-lists";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { HealthDot, StatCard } from "@/components/de-assessment-workspace/shared";

// DE Account Audit queue — the account-level counterpart of the DE Assessment
// queue. Lists every active account that has a DE allocated (DE Account
// Allocation) and reports against the current calendar month: each account must
// be audited at least once (and may be audited any number of times).

const STATUS_BADGE_CLASS: Record<AccountAuditStatus, string> = {
  Due: "bg-slate-100 text-slate-600",
  Draft: "bg-amber-50 text-amber-700",
  Audited: "bg-emerald-50 text-emerald-700",
};

export function DeAccountAuditQueue() {
  const { data, isLoading, isError, error, refetch } = useDeAccountAuditQueue();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [geo, setGeo] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [critical, setCritical] = React.useState("");

  const rows = React.useMemo(() => data?.rows ?? [], [data]);
  const geos = React.useMemo(
    () => [...new Set(rows.map((r) => r.geo_name).filter((v): v is string => !!v))].sort(),
    [rows],
  );
  const regions = React.useMemo(
    () =>
      [...new Set(rows.filter((r) => !geo || r.geo_name === geo).map((r) => r.region_name).filter((v): v is string => !!v))].sort(),
    [rows, geo],
  );
  const filtersActive = !!(geo || region || critical || status);
  const filtered = rows.filter((row) => {
    if (search && !row.account_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (status && row.status !== status) return false;
    if (geo && row.geo_name !== geo) return false;
    if (region && row.region_name !== region) return false;
    if (critical && row.critical_flag !== critical) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Account Assessment</h1>
          <p className="mt-1 text-sm text-slate-500">
            Delivery Excellence audit of accounts — at least once per calendar month
          </p>
        </div>
        {data?.period_label ? (
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
            {data.period_label}
          </span>
        ) : null}
      </header>

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold">Couldn&apos;t load the audit queue.</p>
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
            <StatCard label="Accounts" value={data.total_count} />
            <StatCard label="Audited This Month" value={data.audited_count} />
            <StatCard label="Due This Month" value={data.due_count} />
            <StatCard label="Red / Amber Audited" value={data.red_amber_count} accent="red" />
            <StatCard label="Open Findings" value={data.open_findings_count} />
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <Input
              aria-label="Search Account"
              placeholder="Search Account…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 min-w-[240px] flex-1"
            />
            <div className="w-40 shrink-0">
              <NativeSelect
                aria-label="Geo filter"
                value={geo}
                onChange={(e) => {
                  setGeo(e.target.value);
                  setRegion("");
                }}
                className="h-9 text-sm"
              >
                <option value="">Geo [All]</option>
                {geos.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="w-44 shrink-0">
              <NativeSelect aria-label="Region filter" value={region} onChange={(e) => setRegion(e.target.value)} className="h-9 text-sm">
                <option value="">Region [All]</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="w-44 shrink-0">
              <NativeSelect aria-label="Critical filter" value={critical} onChange={(e) => setCritical(e.target.value)} className="h-9 text-sm">
                <option value="">Critical [All]</option>
                <option value="Yes">Critical: Yes</option>
                <option value="No">Critical: No</option>
              </NativeSelect>
            </div>
            <div className="w-44 shrink-0">
              <NativeSelect aria-label="Status filter" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 text-sm">
                <option value="">Status [All]</option>
                <option value="Due">Due</option>
                <option value="Draft">Draft</option>
                <option value="Audited">Audited</option>
              </NativeSelect>
            </div>
            {filtersActive ? (
              <button
                type="button"
                onClick={() => {
                  setGeo("");
                  setRegion("");
                  setCritical("");
                  setStatus("");
                }}
                className="text-sm font-semibold text-[#1a6fc4] hover:underline"
              >
                Reset
              </button>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {filtered.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">
                {rows.length === 0
                  ? "No accounts to audit — allocate a DE on DE Account Allocation first."
                  : "No accounts match the current filters."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#8EBBE0] bg-[#D6E9F8] text-xs font-bold tracking-wide text-[#205889] uppercase">
                      <th className="px-5 py-3">Account</th>
                      <th className="px-3 py-3">Geo - Region</th>
                      <th className="px-3 py-3">Account Head</th>
                      <th className="px-3 py-3">DE Auditor</th>
                      <th className="px-3 py-3 text-center">DE Health</th>
                      <th className="px-3 py-3 text-center">Open Findings</th>
                      <th className="px-3 py-3 text-center">
                        Status
                        <br />
                        Last Audited
                      </th>
                      <th className="px-5 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr
                        key={row.account_id}
                        className="border-b border-[#E4E9EE] bg-white last:border-b-0 even:bg-[#F8FAFB] hover:bg-[#EDF3F7]"
                      >
                        <td className="px-5 py-2.5 font-semibold text-slate-900">
                          {row.account_name}
                          {row.critical_flag === "Yes" ? (
                            <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">CRITICAL</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{formatGeoRegion(row.geo_name, row.region_name)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.account_head_name ?? "—"}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.delivery_excellence_name ?? "—"}</td>
                        <td className="px-3 py-2.5 text-center">
                          <HealthDot health={row.de_health} />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {row.open_findings_count > 0 ? (
                            <Link
                              href={`/de-account-findings?account=${row.account_id}`}
                              className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 hover:bg-red-200"
                            >
                              {row.open_findings_count}
                            </Link>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col items-center gap-0.5">
                            <span
                              className={cn(
                                "inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-semibold",
                                STATUS_BADGE_CLASS[row.status],
                              )}
                            >
                              {row.status}
                            </span>
                            <span className="text-xs text-slate-400">{row.last_audit_date ?? "-"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Link
                              href={`/de-account-audit/${row.account_id}`}
                              className="rounded-md bg-[#1a6fc4] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a6fc4]/90"
                            >
                              {row.status === "Draft" ? "Continue" : "Assess"}
                            </Link>
                            <Link
                              href={`/de-account-audit/${row.account_id}/history`}
                              className="text-xs font-semibold text-[#1a6fc4] hover:underline"
                            >
                              History
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
