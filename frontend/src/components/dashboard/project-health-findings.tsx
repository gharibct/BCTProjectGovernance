"use client";

import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { useProjectHealthDashboardSummary, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import {
  fetchAllProjectHealthRows,
  formatGeoRegion,
  PROJECT_HEALTH_LIST_PATHS,
  useProjectHealthFindings,
  type FindingRow,
} from "@/lib/api/project-health-lists";
import { ProjectHealthExportButton } from "./project-health-export-button";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, StatTile } from "./project-health-kpi";

const PAGE_SIZE = 10;

type Row = FindingRow & { id: string };

export function ProjectHealthFindings() {
  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({});
  const [skip, setSkip] = React.useState(0);

  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const { data, isLoading, isError, error, refetch } = useProjectHealthFindings({ ...filters, skip, limit: PAGE_SIZE });

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
      key: "finding_title",
      label: "Finding",
      render: (row) => <span className="font-semibold text-slate-900">{row.finding_title}</span>,
    },
    { key: "category", label: "Category" },
    { key: "classification", label: "Classification" },
    {
      key: "action_taken",
      label: "Action Taken",
      render: (row) => <span className="line-clamp-2 max-w-xs text-slate-600">{row.action_taken || "—"}</span>,
    },
    { key: "age_days", label: "Age", render: (row) => (row.age_days === null ? "—" : `${row.age_days} Days`) },
    { key: "status", label: "Status", badge: true },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.finding_id }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Findings</h1>
        <p className="text-slate-500">Delivery Excellence assessment findings.</p>
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
        <StatTile label="Open Findings" value={summary?.findings.open_count ?? "—"} />
        <StatTile
          label="New This Period"
          value={summary?.findings.new_this_period_count ?? "—"}
          accentClassName="border-t-purple-500"
        />
        <StatTile label="Overdue" value={summary?.findings.overdue_count ?? "—"} accentClassName="border-t-red-500" />
        <StatTile
          label="Awaiting Closure"
          value={summary?.findings.awaiting_closure_count ?? "—"}
          accentClassName="border-t-amber-500"
        />
      </div>

      {isError ? (
        <ErrorBlock title="Couldn't load findings." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-end">
            <ProjectHealthExportButton
              filename="project-health-findings"
              columns={columns}
              fetchAll={() => fetchAllProjectHealthRows<Row>(PROJECT_HEALTH_LIST_PATHS.findings, { ...filters })}
            />
          </div>
          <RegisterTable items={rows} columns={columns} emptyLabel={isLoading ? "Loading…" : "No findings found."} />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
