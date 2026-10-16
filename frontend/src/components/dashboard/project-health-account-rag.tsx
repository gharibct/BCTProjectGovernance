"use client";

import { useProjectHealthFilters, useScreenFilters } from "@/stores/project-health-filters";
import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { useProjectHealthDashboardSummary } from "@/lib/api/project-health-dashboard";
import {
  fetchAllProjectHealthRows,
  PROJECT_HEALTH_LIST_PATHS,
  useProjectHealthAccountRag,
  type AccountRagRow,
} from "@/lib/api/project-health-lists";
import { ProjectHealthExportButton } from "./project-health-export-button";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { HeartPulse } from "lucide-react";

import { BackToProjectHealth, Card, ErrorBlock, formatDateTime, HealthBadge, RagFilterTiles } from "./project-health-kpi";

const PAGE_SIZE = 10;

type Row = AccountRagRow & { id: string };

export function ProjectHealthAccountRag() {
  const [filters, setFilters] = useProjectHealthFilters();
  const [skip, setSkip] = React.useState(0);
  // The KPI bucket picked on the tiles below — narrows the list to that bucket.
  const { overall: status, setOverall: setStatus, reset: resetStatus } = useScreenFilters("account-rag");

  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const { data, isLoading, isError, error, refetch } = useProjectHealthAccountRag({ ...filters, status: status || undefined, skip, limit: PAGE_SIZE });

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
      excelValue: (row) => `${row.account_name} (${row.project_count} project${row.project_count === 1 ? "" : "s"})`,
    },
    { key: "geo_name", label: "Geo" },
    { key: "overall_rating", label: "Overall RAG", render: (row) => <HealthBadge value={row.overall_rating ?? "Not Submitted"} /> },
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
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth current="Account RAG Report" />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Account RAG Report</h1>
        <p className="text-slate-500">Latest Account Health Declaration per account, broken out by category.</p>
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSkip(0);
        }}
        extraFiltersActive={!!status}
        onReset={resetStatus}
      />

      <Card
        title="Account Health"
        icon={HeartPulse}
        iconClassName="text-emerald-600"
        period={`Selected Period: ${summary?.period_label ?? "current week"}`}
      >
        <RagFilterTiles
          buckets={["Green", "Amber", "Potential Red", "Red", "Not Submitted"]}
          counts={{
            Green: summary?.account_health.green_count,
            Amber: summary?.account_health.amber_count,
            "Potential Red": summary?.account_health.potential_red_count,
            Red: summary?.account_health.red_count,
            "Not Submitted": summary?.account_health.not_submitted_count,
          }}
          selected={status}
          onSelect={(bucket) => {
            setStatus(bucket);
            setSkip(0);
          }}
        />
      </Card>

      {isError ? (
        <ErrorBlock title="Couldn't load the Account RAG report." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-end">
            <ProjectHealthExportButton
              filename="project-health-account-rag"
              columns={columns}
              fetchAll={() => fetchAllProjectHealthRows<Row>(PROJECT_HEALTH_LIST_PATHS.accountRag, { ...filters, status: status || undefined })}
            />
          </div>
          <RegisterTable items={rows} columns={columns} emptyLabel={isLoading ? "Loading…" : "No accounts found."} />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
