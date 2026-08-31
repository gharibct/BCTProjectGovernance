"use client";

import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { useProjectHealthDashboardSummary, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import { useProjectHealthMetrics, type MetricRow } from "@/lib/api/project-health-lists";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, StatTile } from "./project-health-kpi";

const PAGE_SIZE = 10;

type Row = MetricRow & { id: string };

export function ProjectHealthMetrics() {
  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({});
  const [skip, setSkip] = React.useState(0);

  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const { data, isLoading, isError, error, refetch } = useProjectHealthMetrics({ ...filters, skip, limit: PAGE_SIZE });

  const columns: RegisterColumn<Row>[] = [
    { key: "project_label", label: "Project" },
    { key: "geo_name", label: "Geo" },
    { key: "account_name", label: "Account" },
    {
      key: "metric_name",
      label: "Metric",
      render: (row) => <span className="font-semibold text-slate-900">{row.metric_name}</span>,
    },
    { key: "target", label: "Target" },
    { key: "actual", label: "Actual" },
    { key: "variance", label: "Variance" },
    { key: "status", label: "Status", badge: true },
    { key: "period_label", label: "Period" },
  ];

  const rows: Row[] = (data?.items ?? []).map((row, i) => ({ ...row, id: `${row.project_id}-${row.metric_name}-${i}` }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Metrics</h1>
        <p className="text-slate-500">Delivery metrics compliance against target.</p>
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSkip(0);
        }}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Meeting Target %" value={summary ? `${summary.metrics.compliant_pct}%` : "—"} accentClassName="border-t-emerald-500" />
        <StatTile
          label="Below Target"
          value={summary?.metrics.below_target_count ?? "—"}
          accentClassName="border-t-amber-500"
        />
        <StatTile
          label="Not Reported"
          value={summary?.metrics.not_reported_count ?? "—"}
          accentClassName="border-t-slate-400"
        />
        <StatTile
          label="Critical Variance"
          value={summary?.metrics.critical_variance_count ?? "—"}
          accentClassName="border-t-red-500"
        />
      </div>

      {isError ? (
        <ErrorBlock title="Couldn't load metrics." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <RegisterTable items={rows} columns={columns} emptyLabel={isLoading ? "Loading…" : "No metrics reported."} />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
