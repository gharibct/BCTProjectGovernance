"use client";

import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { cn } from "@/lib/utils";
import { useProjectHealthDashboardSummary, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import { formatGeoRegion, useProjectHealthAssessments, type AssessmentRow } from "@/lib/api/project-health-lists";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, HealthBadge, StatTile } from "./project-health-kpi";

const PAGE_SIZE = 10;

type Row = AssessmentRow & { id: string };

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

export function ProjectHealthAssessments() {
  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({});
  const [skip, setSkip] = React.useState(0);

  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const { data, isLoading, isError, error, refetch } = useProjectHealthAssessments({ ...filters, skip, limit: PAGE_SIZE });

  const columns: RegisterColumn<Row>[] = [
    { key: "project_label", label: "Project" },
    { key: "geo_name", label: "Geo - Region", render: (row) => formatGeoRegion(row.geo_name, row.region_name) },
    { key: "account_name", label: "Account" },
    { key: "pm_health", label: "Project Manager Health", render: (row) => <HealthBadge value={row.pm_health} /> },
    { key: "de_health", label: "DE Health", render: (row) => <HealthBadge value={row.de_health} /> },
    { key: "pci_score", label: "PCI Score", render: (row) => (row.pci_score ? `${row.pci_score}%` : "—") },
    { key: "assessment_period", label: "Assessment Period" },
    { key: "assessed_by_name", label: "Assessed By" },
    { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} /> },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.assessment_id }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Assessments</h1>
        <p className="text-slate-500">Delivery Excellence assessments across the portfolio.</p>
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
        <StatTile label="Completed" value={summary?.de_assessments.completed_count ?? "—"} accentClassName="border-t-emerald-500" />
        <StatTile label="Due" value={summary?.de_assessments.due_count ?? "—"} accentClassName="border-t-amber-500" />
        <StatTile
          label="Red/Amber"
          value={summary?.de_assessments.red_amber_count ?? "—"}
          accentClassName="border-t-red-500"
        />
        <StatTile
          label="Average PCI"
          value={summary?.de_assessments.avg_pci_score ? `${summary.de_assessments.avg_pci_score}%` : "—"}
        />
      </div>

      {isError ? (
        <ErrorBlock title="Couldn't load assessments." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <RegisterTable items={rows} columns={columns} emptyLabel={isLoading ? "Loading…" : "No assessments found."} />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
