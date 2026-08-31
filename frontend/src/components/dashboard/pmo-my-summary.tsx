"use client";

import * as React from "react";
import { Download, RefreshCw } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { usePmoDashboardSummary, type GovernanceComplianceRow } from "@/lib/api/pmo-dashboard";
import { GovernanceComplianceTable } from "./pmo-governance-compliance-table";
import { GovernanceExceptions } from "./pmo-governance-exceptions";
import { ReportingComplianceDonut } from "./pmo-reporting-compliance-donut";

// PMO "My Summary" (design-reference/pmo-mysummary.jpg) — the PMO role's
// portfolio-wide counterpart to de-my-summary.tsx/geo-head-my-summary.tsx:
// org-wide scope (no owned geo/account/project_manager_id), backed by a real
// /dashboard/pmo-summary endpoint. No PMO login exists yet — this screen has
// no route wired into a role's landing page until that ships.

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
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
    </div>
  );
}

function toCsvValue(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportGovernanceComplianceCsv(rows: GovernanceComplianceRow[]) {
  const header = [
    "Project Code",
    "Project Name",
    "Reporting",
    "Measurement",
    "Contractual",
    "RAIDO",
    "Assessment",
    "Overall Status",
  ];
  const lines = [header, ...rows.map((row) => [
    row.project_code,
    row.project_name,
    row.reporting_status,
    row.measurement_status,
    row.contractual_status,
    row.raido_status,
    row.assessment_status,
    row.overall_status,
  ])];
  const csv = lines.map((line) => line.map(toCsvValue).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `governance-compliance-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function PmoMySummary() {
  const { data, isLoading, isError, error, refetch } = usePmoDashboardSummary();
  const [lastUpdated] = React.useState(() => new Date());

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Summary</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
            <RefreshCw className="size-3.5" />
            Last Updated Today at{" "}
            {lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          type="button"
          disabled={!data || data.governance_compliance.length === 0}
          onClick={() => data && exportGovernanceComplianceCsv(data.governance_compliance)}
          className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="size-4" />
          Export
        </button>
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
            <StatCard label="Active Projects" value={data.active_projects_count} />
            <StatCard label="Governance Compliance" value={`${data.governance_compliance_pct}%`} />
            <StatCard label="Reports Overdue" value={data.reports_overdue_count} accent="red" />
            <StatCard label="Assessments Overdue" value={data.assessments_overdue_count} accent="red" />
            <StatCard label="High/Critical Risks" value={data.high_critical_risks_count} />
            <StatCard label="Overdue Actions" value={data.overdue_actions_count} accent="red" />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[360px_1fr]">
            <ReportingComplianceDonut summary={data.reporting_compliance} />
            <GovernanceExceptions rows={data.governance_exceptions} />
          </div>

          <GovernanceComplianceTable rows={data.governance_compliance} />
        </>
      )}
    </div>
  );
}
