"use client";

import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { cn } from "@/lib/utils";
import { useProjectHealthDashboardSummary, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import { formatGeoRegion, useProjectHealthDataIntegrity, type DataIntegrityRow } from "@/lib/api/project-health-lists";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, formatDate, StatTile } from "./project-health-kpi";

const PAGE_SIZE = 10;

type Row = DataIntegrityRow & { id: string };

function StatusPill({ value }: { value: string }) {
  const compliant = value === "Compliant";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1",
        compliant ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"
      )}
    >
      {value}
    </span>
  );
}

export function ProjectHealthDataIntegrity() {
  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({});
  const [skip, setSkip] = React.useState(0);

  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useProjectHealthDataIntegrity({ ...filters, skip, limit: PAGE_SIZE });

  const columns: RegisterColumn<Row>[] = [
    { key: "project_label", label: "Project" },
    { key: "geo_name", label: "Geo - Region", render: (row) => formatGeoRegion(row.geo_name, row.region_name) },
    { key: "account_name", label: "Account" },
    {
      key: "check_name",
      label: "Check",
      render: (row) => <span className="font-semibold text-slate-900">{row.check_name}</span>,
    },
    { key: "category", label: "Category" },
    { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} /> },
    { key: "issue", label: "Issue" },
    { key: "last_checked", label: "Last Checked", render: (row) => formatDate(row.last_checked) },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: `${row.project_id}-${row.item_id}` }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Data Integrity</h1>
        <p className="text-slate-500">Checklist compliance across every project and module.</p>
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
        <StatTile
          label="Overall Compliance"
          value={summary ? `${summary.data_integrity.overall_compliance_pct}%` : "—"}
          accentClassName="border-t-emerald-500"
        />
        <StatTile
          label="Projects With Gaps"
          value={summary?.data_integrity.projects_with_gaps_count ?? "—"}
          accentClassName="border-t-amber-500"
        />
        <StatTile
          label="Critical Gaps"
          value={summary?.data_integrity.critical_gaps_count ?? "—"}
          accentClassName="border-t-red-500"
        />
      </div>

      {isError ? (
        <ErrorBlock title="Couldn't load data integrity." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <RegisterTable items={rows} columns={columns} emptyLabel={isLoading ? "Loading…" : "No checklist items found."} />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
