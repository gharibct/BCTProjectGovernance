"use client";

import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import type { ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import {
  fetchAllProjectHealthRows,
  formatGeoRegion,
  PROJECT_HEALTH_LIST_PATHS,
  useProjectHealthOracleProjects,
  useProjectHealthOracleProjectSummary,
  type OracleProjectMappingStatus,
  type OracleProjectRow,
} from "@/lib/api/project-health-lists";
import { useEffectiveRole } from "@/stores/session";
import { ProjectHealthExportButton } from "./project-health-export-button";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, formatDate, StatTile } from "./project-health-kpi";

const PAGE_SIZE = 15;

type Row = OracleProjectRow & { id: string };

// Roles the Oracle Projects data is withheld from (the endpoints 403 for them).
export function useCanSeeOracleProjects(): boolean {
  const role = useEffectiveRole();
  return role !== "PROJECT_MANAGER" && role !== "TEAM_MEMBER";
}

function monthLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function MappingPill({ row }: { row: Pick<OracleProjectRow, "mapped" | "governance_project_code"> }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1",
        row.mapped ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200",
      )}
    >
      {row.mapped ? (row.governance_project_code ? `Mapped · ${row.governance_project_code}` : "Mapped") : "Not Mapped"}
    </span>
  );
}

// "Geo — Region" resolved from Oracle's Project Geo, or a flag when it couldn't be.
export function OracleGeoCell({ row }: { row: Pick<OracleProjectRow, "geo_name" | "region_name" | "project_geo"> }) {
  if (row.geo_name) return <>{formatGeoRegion(row.geo_name, row.region_name)}</>;
  return (
    <span className="text-amber-700">
      No GEO{row.project_geo ? <span className="text-slate-400"> ({row.project_geo})</span> : null}
    </span>
  );
}

export const oracleProjectColumns: RegisterColumn<Row>[] = [
  {
    key: "project_number",
    label: "Oracle Project",
    render: (row) => (
      <div>
        <p className="font-semibold text-[#1a6fc4]">{row.project_number}</p>
        <p className="text-xs text-slate-500">{row.project_name}</p>
      </div>
    ),
    excelValue: (row) => `${row.project_number} — ${row.project_name}`,
  },
  { key: "account_name", label: "Account", render: (row) => row.account_name ?? "—", excelValue: (row) => row.account_name ?? "" },
  { key: "project_type", label: "Project Type", render: (row) => row.project_type ?? "—", excelValue: (row) => row.project_type ?? "" },
  { key: "project_geo", label: "Oracle Project Geo", render: (row) => row.project_geo ?? "—", excelValue: (row) => row.project_geo ?? "" },
  {
    key: "geo_name",
    label: "Geo - Region",
    render: (row) => <OracleGeoCell row={row} />,
    excelValue: (row) => (row.geo_name ? formatGeoRegion(row.geo_name, row.region_name) : ""),
  },
  { key: "start_date", label: "Start Date", render: (row) => formatDate(row.start_date), excelValue: (row) => row.start_date ?? "" },
  { key: "end_date", label: "End Date", render: (row) => formatDate(row.end_date), excelValue: (row) => row.end_date ?? "" },
  {
    key: "last_seen_month",
    label: "Last In Oracle Report",
    render: (row) => monthLabel(row.last_seen_month),
    excelValue: (row) => row.last_seen_month,
  },
  {
    key: "mapped",
    label: "Governance Project",
    render: (row) => <MappingPill row={row} />,
    excelValue: (row) => (row.mapped ? (row.governance_project_code ?? "Mapped") : "Not Mapped"),
  },
];

const STATUS_OPTIONS: { value: OracleProjectMappingStatus; label: string }[] = [
  { value: "unmapped", label: "Not Mapped" },
  { value: "mapped", label: "Mapped" },
  { value: "all", label: "All" },
];

// Drill-down behind the dashboard's Oracle Projects section: every Oracle
// project in the caller's scope and whether a governance project carries its
// number. Geo Heads get their geos' projects plus those with no GEO; Delivery
// Managers get their accounts'; Project Managers don't get this page.
export function ProjectHealthOracleProjects() {
  const canSee = useCanSeeOracleProjects();
  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({});
  const [status, setStatus] = React.useState<OracleProjectMappingStatus>("unmapped");
  const [search, setSearch] = React.useState("");
  const [skip, setSkip] = React.useState(0);

  const { data: summary } = useProjectHealthOracleProjectSummary(filters, canSee);
  const { data, isLoading, isError, error, refetch } = useProjectHealthOracleProjects(
    { ...filters, status, search: search || undefined, skip, limit: PAGE_SIZE },
    canSee,
  );

  if (!canSee) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <BackToProjectHealth />
        <p className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-slate-500">
          Oracle projects are not available for your role.
        </p>
      </div>
    );
  }

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.oracle_project_id }));
  const total = summary ? summary.mapped_count + summary.unmapped_count : "—";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Oracle Projects</h1>
        <p className="text-slate-500">
          Oracle projects and whether a governance project has been created for them. Projects not onboarded in
          Governance One still need one.
        </p>
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSkip(0);
        }}
        showPeriod={false}
        showRegion
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Oracle Projects" value={total} />
        <StatTile label="Onboarded to GovOne" value={summary?.mapped_count ?? "—"} accentClassName="border-t-emerald-500" />
        <StatTile
          label="Not Onboarded to GovOne"
          value={summary?.unmapped_count ?? "—"}
          accentClassName="border-t-red-500"
        />
        <StatTile
          label="Not Mapped to Geo in Oracle"
          value={summary?.unmapped_no_geo_count ?? "—"}
          accentClassName="border-t-amber-500"
        />
      </div>

      {isError ? (
        <ErrorBlock title="Couldn't load the Oracle projects." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSkip(0);
                }}
                placeholder="Search project no., name or account…"
                className="w-72 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#1a6fc4] focus:outline-none"
              />
              <div className="w-40">
                <NativeSelect
                  aria-label="Mapping status"
                  className="h-9 bg-white text-sm"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as OracleProjectMappingStatus);
                    setSkip(0);
                  }}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <ProjectHealthExportButton
              filename="oracle-projects"
              columns={oracleProjectColumns}
              fetchAll={() =>
                fetchAllProjectHealthRows<Row>(PROJECT_HEALTH_LIST_PATHS.oracleProjects, {
                  ...filters,
                  status,
                  search: search || undefined,
                }).then((all) => all.map((row) => ({ ...row, id: row.oracle_project_id })))
              }
            />
          </div>

          <RegisterTable
            items={rows}
            columns={oracleProjectColumns}
            emptyLabel={isLoading ? "Loading…" : "No Oracle projects found."}
          />

          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
