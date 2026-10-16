"use client";

import { useProjectHealthFilters, useScreenFilters } from "@/stores/project-health-filters";
import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { useProjectHealthDashboardSummary } from "@/lib/api/project-health-dashboard";
import {
  fetchAllProjectHealthRows,
  formatGeoRegion,
  PROJECT_HEALTH_LIST_PATHS,
  useProjectHealthRag,
  type RagRow,
} from "@/lib/api/project-health-lists";
import { ProjectHealthExportButton } from "./project-health-export-button";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { HeartPulse } from "lucide-react";

import { BackToProjectHealth, Card, ErrorBlock, formatDateTime, HealthBadge, RagFilterTiles } from "./project-health-kpi";

const PAGE_SIZE = 10;

type Row = RagRow & { id: string };

export function ProjectHealthRag() {
  const [filters, setFilters] = useProjectHealthFilters();
  const [skip, setSkip] = React.useState(0);
  // The KPI bucket picked on the tiles below — narrows the list to that bucket.
  const { overall: status, setOverall: setStatus, reset: resetStatus } = useScreenFilters("rag");

  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const { data, isLoading, isError, error, refetch } = useProjectHealthRag({ ...filters, status: status || undefined, skip, limit: PAGE_SIZE });

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
      excelValue: (row) => `${row.project_code} — ${row.project_name}`,
    },
    {
      key: "geo_name",
      label: "Geo - Region",
      render: (row) => formatGeoRegion(row.geo_name, row.region_name),
      excelValue: (row) => formatGeoRegion(row.geo_name, row.region_name),
    },
    { key: "account_name", label: "Account" },
    { key: "overall_rating", label: "Overall RAG", render: (row) => <HealthBadge value={row.overall_rating ?? "Not Submitted"} /> },
    { key: "core_delivery_rating", label: "Core Delivery", render: (row) => <HealthBadge value={row.core_delivery_rating} /> },
    { key: "operational_rating", label: "Operational", render: (row) => <HealthBadge value={row.operational_rating} /> },
    { key: "financial_rating", label: "Financial", render: (row) => <HealthBadge value={row.financial_rating} /> },
    { key: "period_label", label: "Period" },
    { key: "last_updated", label: "Last Updated", render: (row) => formatDateTime(row.last_updated) },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.project_id }));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth current="RAG Report" />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">RAG Report</h1>
        <p className="text-slate-500">Detailed health status and reporting compliance.</p>
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
        title="Project Health"
        icon={HeartPulse}
        iconClassName="text-emerald-600"
        period={`Selected Period: ${summary?.period_label ?? "current week"}`}
      >
        <RagFilterTiles
          buckets={["Green", "Amber", "Potential Red", "Red", "Not Submitted"]}
          counts={{
            Green: summary?.health.green_count,
            Amber: summary?.health.amber_count,
            "Potential Red": summary?.health.potential_red_count,
            Red: summary?.health.red_count,
            "Not Submitted": summary?.health.not_submitted_count,
          }}
          selected={status}
          onSelect={(bucket) => {
            setStatus(bucket);
            setSkip(0);
          }}
        />
      </Card>

      {isError ? (
        <ErrorBlock title="Couldn't load the RAG report." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-end">
            <ProjectHealthExportButton
              filename="project-health-rag"
              columns={columns}
              fetchAll={() => fetchAllProjectHealthRows<Row>(PROJECT_HEALTH_LIST_PATHS.rag, { ...filters, status: status || undefined })}
            />
          </div>
          <RegisterTable items={rows} columns={columns} emptyLabel={isLoading ? "Loading…" : "No projects found."} />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
