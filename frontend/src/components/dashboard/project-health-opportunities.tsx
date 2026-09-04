"use client";

import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { useProjectHealthDashboardSummary, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import {
  fetchAllProjectHealthRows,
  formatGeoRegion,
  PROJECT_HEALTH_LIST_PATHS,
  useProjectHealthOpportunities,
  type OpportunityRow,
} from "@/lib/api/project-health-lists";
import { ProjectHealthExportButton } from "./project-health-export-button";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, formatDate, StatTile } from "./project-health-kpi";

const PAGE_SIZE = 10;

type Row = OpportunityRow & { id: string };

export function ProjectHealthOpportunities() {
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
  } = useProjectHealthOpportunities({ ...filters, search: search || undefined, skip, limit: PAGE_SIZE });

  const columns: RegisterColumn<Row>[] = [
    { key: "project_label", label: "Project" },
    {
      key: "geo_name",
      label: "Geo - Region",
      render: (row) => formatGeoRegion(row.geo_name, row.region_name),
      excelValue: (row) => formatGeoRegion(row.geo_name, row.region_name),
    },
    { key: "account_name", label: "Account" },
    {
      key: "opportunity_title",
      label: "Opportunity",
      render: (row) => <span className="font-semibold text-slate-900">{row.opportunity_title}</span>,
    },
    { key: "category", label: "Category" },
    { key: "priority", label: "Priority", badge: true },
    { key: "owner_name", label: "Owner" },
    { key: "target_date", label: "Target Date", render: (row) => formatDate(row.target_date) },
    { key: "status", label: "Status", badge: true },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.opportunity_id }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Opportunities</h1>
        <p className="text-slate-500">Identified improvement and growth opportunities.</p>
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
        <StatTile label="Open Opportunities" value={summary?.opportunities.open_count ?? "—"} />
        <StatTile
          label="High Priority"
          value={summary?.opportunities.high_priority_count ?? "—"}
          accentClassName="border-t-emerald-500"
        />
        <StatTile
          label="Pending Approval"
          value={summary?.opportunities.pending_approval_count ?? "—"}
          accentClassName="border-t-amber-500"
        />
      </div>

      {isError ? (
        <ErrorBlock title="Couldn't load opportunities." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSkip(0);
              }}
              placeholder="Search opportunities…"
              className="w-full max-w-sm rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#1a6fc4] focus:outline-none"
            />
            <ProjectHealthExportButton
              filename="project-health-opportunities"
              columns={columns}
              fetchAll={() =>
                fetchAllProjectHealthRows<Row>(PROJECT_HEALTH_LIST_PATHS.opportunities, {
                  ...filters,
                  search: search || undefined,
                })
              }
            />
          </div>

          <RegisterTable items={rows} columns={columns} emptyLabel={isLoading ? "Loading…" : "No opportunities found."} />

          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
