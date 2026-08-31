"use client";

import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { useProjectHealthDashboardSummary, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import { useProjectHealthAssumptions, type AssumptionRow } from "@/lib/api/project-health-lists";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, formatDate, StatTile } from "./project-health-kpi";

const PAGE_SIZE = 10;

type Row = AssumptionRow & { id: string };

export function ProjectHealthAssumptions() {
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
  } = useProjectHealthAssumptions({ ...filters, search: search || undefined, skip, limit: PAGE_SIZE });

  const columns: RegisterColumn<Row>[] = [
    { key: "project_label", label: "Project" },
    { key: "geo_name", label: "Geo" },
    { key: "account_name", label: "Account" },
    {
      key: "title",
      label: "Assumption",
      render: (row) => <span className="font-semibold text-slate-900">{row.title}</span>,
    },
    { key: "owner_name", label: "Owner" },
    { key: "review_date", label: "Review Date", render: (row) => formatDate(row.review_date) },
    { key: "status", label: "Status", badge: true },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.assumption_id }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Assumptions</h1>
        <p className="text-slate-500">Tracked assumptions and their validation status.</p>
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSkip(0);
        }}
        showPeriod={false}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Open Assumptions" value={summary?.assumptions.open_count ?? "—"} />
        <StatTile
          label="Review Due"
          value={summary?.assumptions.review_due_count ?? "—"}
          accentClassName="border-t-amber-500"
        />
        <StatTile label="Overdue" value={summary?.assumptions.overdue_count ?? "—"} accentClassName="border-t-red-500" />
      </div>

      {isError ? (
        <ErrorBlock title="Couldn't load assumptions." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSkip(0);
            }}
            placeholder="Search assumptions…"
            className="w-full max-w-sm rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#1a6fc4] focus:outline-none"
          />

          <RegisterTable items={rows} columns={columns} emptyLabel={isLoading ? "Loading…" : "No assumptions found."} />

          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
