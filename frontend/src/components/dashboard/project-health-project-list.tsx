"use client";

import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { StatusBadge } from "@/components/forms/status-badge";
import { useProjectHealthDashboardSummary, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import { useProjectHealthProjectList, type ProjectListRow } from "@/lib/api/project-health-lists";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, formatDate, HealthBadge, StatTile } from "./project-health-kpi";

const PAGE_SIZE = 10;

type Row = ProjectListRow & { id: string };

export function ProjectHealthProjectList() {
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
  } = useProjectHealthProjectList({ ...filters, search: search || undefined, skip, limit: PAGE_SIZE });

  const columns: RegisterColumn<Row>[] = [
    {
      key: "project_code",
      label: "Project",
      render: (row) => (
        <div>
          <p className="font-semibold text-[#1a6fc4]">{row.project_code}</p>
          <p className="text-xs text-slate-500">{row.project_name}</p>
        </div>
      ),
    },
    { key: "project_type_name", label: "Project Type" },
    { key: "geo_name", label: "Geo" },
    { key: "account_name", label: "Account" },
    { key: "project_manager_name", label: "Project Manager" },
    { key: "start_date", label: "Start Date", render: (row) => formatDate(row.start_date) },
    { key: "end_date", label: "End Date", render: (row) => formatDate(row.end_date) },
    { key: "overall_health", label: "Overall Health", render: (row) => <HealthBadge value={row.overall_health} /> },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.project_id }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Project List</h1>
        <p className="text-slate-500">Detailed directory of all active and historical initiatives.</p>
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
        <StatTile label="Total Projects" value={summary?.portfolio.total_count ?? "—"} />
        <StatTile label="Active" value={summary?.portfolio.active_count ?? "—"} accentClassName="border-t-emerald-500" />
        <StatTile
          label="Completed"
          value={summary?.portfolio.completed_count ?? "—"}
          accentClassName="border-t-slate-400"
        />
        <StatTile label="On Hold" value={summary?.portfolio.on_hold_count ?? "—"} accentClassName="border-t-amber-500" />
      </div>

      {isError ? (
        <ErrorBlock title="Couldn't load the project list." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSkip(0);
            }}
            placeholder="Search projects…"
            className="w-full max-w-sm rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#1a6fc4] focus:outline-none"
          />

          <RegisterTable
            items={rows}
            columns={columns}
            emptyLabel={isLoading ? "Loading…" : "No projects found."}
          />

          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
