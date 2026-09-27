"use client";

import * as React from "react";
import Link from "next/link";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { useProjectHealthDashboardSummary, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import {
  CUSTOMER_REPORT_STATUSES,
  fetchAllProjectHealthRows,
  formatGeoRegion,
  PROJECT_HEALTH_LIST_PATHS,
  useProjectHealthCustomerProjectReports,
  type CustomerProjectReportRow,
} from "@/lib/api/project-health-lists";
import { ProjectHealthExportButton } from "./project-health-export-button";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, formatDate, StatTile } from "./project-health-kpi";
import { ACCOUNT_MANAGER_LABEL } from "@/lib/role-labels";

const PAGE_SIZE = 15;
const ROUTE = "/project-health/customer-project-reports";

type Row = CustomerProjectReportRow & { id: string };

const STATUS_TONE: Record<string, string> = {
  [CUSTOMER_REPORT_STATUSES.shared]: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  [CUSTOMER_REPORT_STATUSES.notShared]: "bg-amber-50 text-amber-700 ring-amber-200",
  [CUSTOMER_REPORT_STATUSES.notSubmitted]: "bg-red-50 text-red-700 ring-red-200",
};

function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1",
        STATUS_TONE[value] ?? "bg-slate-100 text-slate-600 ring-slate-200",
      )}
    >
      {value}
    </span>
  );
}

const dash = (value: string | null | undefined) => (value && value.trim() ? value : "—");

// Drill-down behind the dashboard's Customer Project Status Reporting card: one
// row per active project that owed the selected week's status report, with
// whether that report was shared with the customer. All statuses are shown by
// default, sorted with Not Submitted first.
export function ProjectHealthCustomerProjectReports() {
  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({});
  const [status, setStatus] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [skip, setSkip] = React.useState(0);

  const listParams = { ...filters, status: status || undefined, search: search || undefined };
  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const { data, isLoading, isError, error, refetch } = useProjectHealthCustomerProjectReports({
    ...listParams,
    skip,
    limit: PAGE_SIZE,
  });

  const kpi = summary?.customer_project_reports;
  const owed = kpi ? kpi.shared_count + kpi.not_shared_count + kpi.not_submitted_count : 0;
  const adherence = kpi ? (owed > 0 ? Math.round((kpi.shared_count / owed) * 100) : 0) : null;

  const columns: RegisterColumn<Row>[] = [
    { key: "project_label", label: "Project" },
    {
      key: "geo_name",
      label: "Geo - Region",
      render: (row) => formatGeoRegion(row.geo_name, row.region_name),
      excelValue: (row) => formatGeoRegion(row.geo_name, row.region_name),
    },
    { key: "account_name", label: "Account", render: (row) => dash(row.account_name), excelValue: (row) => row.account_name ?? "" },
    { key: "project_manager_name", label: "PM", render: (row) => dash(row.project_manager_name), excelValue: (row) => row.project_manager_name ?? "" },
    { key: "account_head_name", label: ACCOUNT_MANAGER_LABEL, render: (row) => dash(row.account_head_name), excelValue: (row) => row.account_head_name ?? "" },
    { key: "period_label", label: "Period" },
    { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} />, excelValue: (row) => row.status },
    {
      key: "customer_report_date",
      label: "Date Shared",
      render: (row) => formatDate(row.customer_report_date),
      excelValue: (row) => row.customer_report_date ?? "",
    },
    { key: "customer_remarks", label: "Remarks", render: (row) => dash(row.customer_remarks), excelValue: (row) => row.customer_remarks ?? "" },
    {
      key: "view",
      label: "",
      excelValue: () => "",
      render: (row) =>
        row.status === CUSTOMER_REPORT_STATUSES.notSubmitted ? null : (
          <Link
            href={`/project-review/${row.project_id}?period=${row.period_id}&back=${encodeURIComponent(ROUTE)}`}
            className="text-sm font-semibold text-[#1a6fc4] hover:underline"
          >
            View
          </Link>
        ),
    },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.project_id }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Customer Project Status Reporting</h1>
        <p className="text-slate-500">
          Active projects that owed the selected week&apos;s status report — whether it was shared with the customer.
          Adherence is Shared ÷ projects owed; Draft or missing reports are Not Submitted.
        </p>
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSkip(0);
        }}
        extraFiltersActive={Boolean(status)}
        onReset={() => {
          setStatus("");
          setSkip(0);
        }}
      >
        <div className="w-52">
          <NativeSelect
            aria-label="Customer sharing status"
            className="h-9 bg-white text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setSkip(0);
            }}
          >
            <option value="">Status [All]</option>
            <option value={CUSTOMER_REPORT_STATUSES.shared}>Shared with Customer</option>
            <option value={CUSTOMER_REPORT_STATUSES.notShared}>Not Shared</option>
            <option value={CUSTOMER_REPORT_STATUSES.notSubmitted}>Not Submitted</option>
          </NativeSelect>
        </div>
      </ProjectHealthFilterBar>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Adherence" value={adherence === null ? "—" : `${adherence}%`} accentClassName="border-t-[#1a6fc4]" />
        <StatTile label="Shared with Customer" value={kpi?.shared_count ?? "—"} accentClassName="border-t-emerald-500" />
        <StatTile label="Not Shared" value={kpi?.not_shared_count ?? "—"} accentClassName="border-t-amber-500" />
        <StatTile label="Not Submitted" value={kpi?.not_submitted_count ?? "—"} accentClassName="border-t-red-500" />
      </div>

      {isError ? (
        <ErrorBlock title="Couldn't load customer project status reporting." error={error} onRetry={() => refetch()} />
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
              placeholder="Search projects or accounts…"
              className="w-full max-w-sm rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#1a6fc4] focus:outline-none"
            />
            <ProjectHealthExportButton
              filename="project-health-customer-project-reports"
              columns={columns}
              fetchAll={() =>
                fetchAllProjectHealthRows<Row>(PROJECT_HEALTH_LIST_PATHS.customerProjectReports, { ...listParams })
              }
            />
          </div>
          <RegisterTable
            items={rows}
            columns={columns}
            emptyLabel={isLoading ? "Loading…" : "No projects owed a status report for this selection."}
          />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
