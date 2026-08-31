"use client";

import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { useProjectHealthDashboardSummary, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import { useProjectHealthActions, type ActionRow } from "@/lib/api/project-health-lists";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, formatDate, StatTile } from "./project-health-kpi";

const PAGE_SIZE = 10;

type Row = ActionRow & { id: string };

export function ProjectHealthActions() {
  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({});
  const [search, setSearch] = React.useState("");
  const [skip, setSkip] = React.useState(0);
  const isFiltered = Boolean(filters.geoId || filters.accountId || filters.projectTypeId);

  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useProjectHealthActions({ ...filters, search: search || undefined, skip, limit: PAGE_SIZE });

  const columns: RegisterColumn<Row>[] = [
    { key: "level", label: "Level" },
    { key: "scope_label", label: "Geo/Account/Project" },
    {
      key: "title",
      label: "Action",
      render: (row) => <span className="font-semibold text-slate-900">{row.title}</span>,
    },
    { key: "assigned_to_name", label: "Assigned To" },
    { key: "due_date", label: "Due Date", render: (row) => formatDate(row.due_date) },
    { key: "age_days", label: "Age", render: (row) => `${row.age_days} Days` },
    { key: "status", label: "Status", badge: true },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.action_id }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Actions</h1>
        <p className="text-slate-500">Governance actions tracked across Geo, Account, and Project levels.</p>
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
        <StatTile label="Open" value={summary?.actions.open_count ?? "—"} />
        <StatTile label="In Progress" value={summary?.actions.in_progress_count ?? "—"} />
        <StatTile label="Overdue" value={summary?.actions.overdue_count ?? "—"} accentClassName="border-t-red-500" />
        <StatTile
          label="Due This Week"
          value={summary?.actions.due_this_week_count ?? "—"}
          accentClassName="border-t-amber-500"
        />
      </div>
      {isFiltered ? (
        <p className="-mt-3 text-[11px] text-slate-400">Geo/Account-level actions are excluded while a filter is active.</p>
      ) : null}

      {isError ? (
        <ErrorBlock title="Couldn't load actions." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSkip(0);
            }}
            placeholder="Search actions…"
            className="w-full max-w-sm rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#1a6fc4] focus:outline-none"
          />

          <RegisterTable items={rows} columns={columns} emptyLabel={isLoading ? "Loading…" : "No actions found."} />

          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
