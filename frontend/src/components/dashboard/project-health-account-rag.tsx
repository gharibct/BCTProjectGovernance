"use client";

import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { useProjectHealthDashboardSummary, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import { useProjectHealthAccountRag, type AccountRagRow } from "@/lib/api/project-health-lists";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, formatDateTime, HealthBadge, StatTile } from "./project-health-kpi";

const PAGE_SIZE = 10;

type Row = AccountRagRow & { id: string };

export function ProjectHealthAccountRag() {
  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({});
  const [skip, setSkip] = React.useState(0);

  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const { data, isLoading, isError, error, refetch } = useProjectHealthAccountRag({ ...filters, skip, limit: PAGE_SIZE });

  const columns: RegisterColumn<Row>[] = [
    {
      key: "account_name",
      label: "Account",
      render: (row) => (
        <div>
          <p className="font-semibold text-[#1a6fc4]">{row.account_name}</p>
          <p className="text-xs text-slate-500">{row.project_count} project{row.project_count === 1 ? "" : "s"}</p>
        </div>
      ),
    },
    { key: "geo_name", label: "Geo" },
    { key: "overall_rating", label: "Overall RAG", render: (row) => <HealthBadge value={row.overall_rating} /> },
    { key: "core_delivery_rating", label: "Core Delivery", render: (row) => <HealthBadge value={row.core_delivery_rating} /> },
    { key: "people_rating", label: "People", render: (row) => <HealthBadge value={row.people_rating} /> },
    { key: "operational_rating", label: "Operational", render: (row) => <HealthBadge value={row.operational_rating} /> },
    { key: "customer_rating", label: "Customer", render: (row) => <HealthBadge value={row.customer_rating} /> },
    { key: "financial_rating", label: "Financial", render: (row) => <HealthBadge value={row.financial_rating} /> },
    { key: "compliance_rating", label: "Compliance", render: (row) => <HealthBadge value={row.compliance_rating} /> },
    { key: "period_label", label: "Period" },
    { key: "last_updated", label: "Last Updated", render: (row) => formatDateTime(row.last_updated) },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.account_id }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Account RAG Report</h1>
        <p className="text-slate-500">Latest Account Health Declaration per account, broken out by category.</p>
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSkip(0);
        }}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatTile label="Green" value={summary?.account_health.green_count ?? "—"} accentClassName="border-t-emerald-500" />
        <StatTile label="Amber" value={summary?.account_health.amber_count ?? "—"} accentClassName="border-t-amber-500" />
        <StatTile
          label="Potential Red"
          value={summary?.account_health.potential_red_count ?? "—"}
          accentClassName="border-t-orange-500"
        />
        <StatTile label="Red" value={summary?.account_health.red_count ?? "—"} accentClassName="border-t-red-500" />
        <StatTile
          label="Reporting Overdue"
          value={summary?.account_health.reporting_overdue_count ?? "—"}
          accentClassName="border-t-slate-400"
        />
      </div>

      {isError ? (
        <ErrorBlock title="Couldn't load the Account RAG report." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <RegisterTable items={rows} columns={columns} emptyLabel={isLoading ? "Loading…" : "No accounts found."} />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
