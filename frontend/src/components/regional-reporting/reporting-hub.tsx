"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageBanner } from "@/components/shell/page-banner";
import { StatusBadge } from "@/components/forms/status-badge";
import { useAccounts, useGeos, useReportingPeriods } from "@/lib/api/reference-data";
import { useRegionalStatusReports, type RegionalScope } from "@/lib/api/regional-status";
import { StarterCards } from "./starter-cards";

const SCOPE_LABEL: Record<RegionalScope, string> = {
  account: "Account Reporting",
  geo: "Geo Reporting",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

// Mirrors project-reporting/reporting-hub.tsx, minus the health-rollup KPI
// tiles — there is no automatic rollup here, Account Managers/Geo Heads
// write these reports by hand each period (per direct product decision).
export function ReportingHub({ scope, scopeId }: { scope: RegionalScope; scopeId: string }) {
  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();
  const name =
    scope === "account"
      ? (accounts.find((a) => a.id === scopeId)?.name ?? SCOPE_LABEL.account)
      : (geos.find((g) => g.id === scopeId)?.name ?? SCOPE_LABEL.geo);

  const { data: periods = [] } = useReportingPeriods();
  const { data: reports = [] } = useRegionalStatusReports(scope, scopeId);
  // Both Account and Geo Reporting have a Dashboard preview + submit screen
  // (like Project Reporting's) — opening a report from the hub always lands
  // there first; Status Reporting stays reachable from the nav for edits.
  const entryHref = `/${scope}-reporting/${scopeId}/dashboard`;

  const latestReport = reports[0];
  const latestReportHref = latestReport ? `${entryHref}?period=${latestReport.period_id}` : entryHref;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">{name}</h1>
          <p className="mt-2 max-w-3xl text-slate-500">{SCOPE_LABEL[scope]}</p>
        </div>
        <Button
          asChild
          className="h-11 shrink-0 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
        >
          <Link href={latestReportHref}>Goto Latest Report</Link>
        </Button>
      </div>

      <PageBanner />

      <StarterCards scope={scope} scopeId={scopeId} />

      <section>
        <h2 className="text-lg font-bold text-slate-900">Reporting History</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr className="text-xs tracking-wide text-slate-500 uppercase">
                <th className="px-6 py-3 font-bold">Reporting Period</th>
                <th className="px-3 py-3 font-bold">Type</th>
                <th className="px-3 py-3 font-bold">Created On</th>
                <th className="px-3 py-3 font-bold">Status</th>
                <th className="px-3 py-3 font-bold">Last Updated</th>
                <th className="px-6 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-slate-400">
                    No reports submitted yet.
                  </td>
                </tr>
              ) : (
                reports.map((report) => {
                  const period = periods.find((p) => p.id === report.period_id);
                  return (
                    <tr
                      key={report.id}
                      className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-6 py-3.5 font-bold text-slate-900">{period?.label ?? "—"}</td>
                      <td className="px-3 py-3.5">
                        <span
                          className={cn(
                            "rounded px-2.5 py-1 text-xs font-semibold",
                            period?.period_type === "Weekly"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-blue-50 text-[#1a6fc4]"
                          )}
                        >
                          {period?.period_type ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-slate-700">{formatDate(report.created_at)}</td>
                      <td className="px-3 py-3.5">
                        <StatusBadge value={report.status} />
                      </td>
                      <td className="px-3 py-3.5 text-slate-700">{formatDate(report.updated_at)}</td>
                      <td className="px-6 py-3.5 text-right">
                        <Button asChild variant="outline" className="h-8 w-20 text-xs font-semibold">
                          <Link href={`${entryHref}?period=${report.period_id}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
