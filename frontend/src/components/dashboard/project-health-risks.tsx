"use client";

import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { useProjectHealthDashboardSummary, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import { useProjectHealthRisks, type RiskRow } from "@/lib/api/project-health-lists";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, formatDate, StatTile } from "./project-health-kpi";

const PAGE_SIZE = 10;

type Row = RiskRow & { id: string };

export function ProjectHealthRisks() {
  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({});
  const [search, setSearch] = React.useState("");
  const [skip, setSkip] = React.useState(0);

  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useProjectHealthRisks({ ...filters, search: search || undefined, skip, limit: PAGE_SIZE });

  const columns: RegisterColumn<Row>[] = [
    { key: "project_label", label: "Project" },
    { key: "geo_name", label: "Geo" },
    { key: "account_name", label: "Account" },
    {
      key: "risk_title",
      label: "Risk",
      render: (row) => <span className="font-semibold text-slate-900">{row.risk_title}</span>,
    },
    { key: "risk_category", label: "Category" },
    { key: "probability", label: "Probability" },
    { key: "impact", label: "Impact" },
    { key: "severity", label: "Rating", badge: true },
    {
      key: "mitigation_plan",
      label: "Mitigation",
      render: (row) => <span className="line-clamp-2 max-w-xs text-slate-600">{row.mitigation_plan || "—"}</span>,
    },
    { key: "owner_name", label: "Owner" },
    { key: "target_resolution_date", label: "Due Date", render: (row) => formatDate(row.target_resolution_date) },
    { key: "current_status", label: "Status", badge: true },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.risk_id }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Risks</h1>
        <p className="text-slate-500">Active risk assessment and mitigation tracking.</p>
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSkip(0);
        }}
        showPeriod={false}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Open Risks" value={summary?.risks.open_count ?? "—"} />
        <StatTile
          label="High/Critical"
          value={summary?.risks.high_critical_count ?? "—"}
          accentClassName="border-t-red-500"
        />
        <StatTile label="Overdue" value={summary?.risks.overdue_count ?? "—"} accentClassName="border-t-amber-500" />
        <StatTile
          label="No Mitigation"
          value={summary?.risks.no_mitigation_count ?? "—"}
          accentClassName="border-t-slate-400"
        />
      </div>

      {isError ? (
        <ErrorBlock title="Couldn't load risks." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSkip(0);
            }}
            placeholder="Search risks…"
            className="w-full max-w-sm rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#1a6fc4] focus:outline-none"
          />

          <RegisterTable items={rows} columns={columns} emptyLabel={isLoading ? "Loading…" : "No risks found."} />

          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
