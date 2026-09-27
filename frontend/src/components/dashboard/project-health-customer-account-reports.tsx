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
  useProjectHealthCustomerAccountReports,
  type CustomerAccountReportRow,
} from "@/lib/api/project-health-lists";
import { ProjectHealthExportButton } from "./project-health-export-button";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, formatDate, StatTile } from "./project-health-kpi";
import { ACCOUNT_MANAGER_LABEL } from "@/lib/role-labels";

const PAGE_SIZE = 15;

type Row = CustomerAccountReportRow & { id: string };

const STATUS_TONE: Record<string, string> = {
  [CUSTOMER_REPORT_STATUSES.shared]: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  [CUSTOMER_REPORT_STATUSES.notShared]: "bg-red-50 text-red-700 ring-red-200",
  [CUSTOMER_REPORT_STATUSES.new]: "bg-blue-50 text-blue-700 ring-blue-200",
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

// Drill-down behind the dashboard's Customer Account Reporting card: one row per
// active account with whether it shared a presentation with the customer in the
// previous calendar quarter (the current quarter is ignored). Accounts onboarded
// in the current quarter are New and left out of Adherence. The dashboard's
// Period filter doesn't apply (the window is fixed).
export function ProjectHealthCustomerAccountReports() {
  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({});
  const [status, setStatus] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [skip, setSkip] = React.useState(0);

  const listParams = { ...filters, status: status || undefined, search: search || undefined };
  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const { data, isLoading, isError, error, refetch } = useProjectHealthCustomerAccountReports({
    ...listParams,
    skip,
    limit: PAGE_SIZE,
  });

  const kpi = summary?.customer_account_reports;
  const judged = kpi ? kpi.shared_count + kpi.not_shared_count : 0;
  const adherence = kpi ? (judged > 0 ? Math.round((kpi.shared_count / judged) * 100) : 0) : null;

  const columns: RegisterColumn<Row>[] = [
    { key: "account_name", label: "Account" },
    {
      key: "geo_name",
      label: "Geo - Region",
      render: (row) => formatGeoRegion(row.geo_name, row.region_name),
      excelValue: (row) => formatGeoRegion(row.geo_name, row.region_name),
    },
    { key: "account_head_name", label: ACCOUNT_MANAGER_LABEL, render: (row) => dash(row.account_head_name), excelValue: (row) => row.account_head_name ?? "" },
    { key: "geo_head_name", label: "Geo Head", render: (row) => dash(row.geo_head_name), excelValue: (row) => row.geo_head_name ?? "" },
    { key: "onboarded_date", label: "Onboarded", render: (row) => formatDate(row.onboarded_date), excelValue: (row) => row.onboarded_date ?? "" },
    { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} />, excelValue: (row) => row.status },
    {
      key: "last_shared_date",
      label: "Last Shared",
      render: (row) => formatDate(row.last_shared_date),
      excelValue: (row) => row.last_shared_date ?? "",
    },
    { key: "last_title", label: "Latest Presentation", render: (row) => dash(row.last_title), excelValue: (row) => row.last_title ?? "" },
    {
      key: "communications_count",
      label: "Shared (12 mo.)",
      render: (row) => row.communications_count,
      excelValue: (row) => row.communications_count,
    },
    {
      key: "view",
      label: "",
      excelValue: () => "",
      render: (row) =>
        row.communications_count > 0 ? (
          <Link
            href={`/account-reporting/${row.account_id}/customer-communications`}
            className="text-sm font-semibold text-[#1a6fc4] hover:underline"
          >
            View
          </Link>
        ) : null,
    },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.account_id }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Customer Account Reporting</h1>
        <p className="text-slate-500">
          Active accounts and whether they shared a presentation with the customer in the previous calendar quarter (no entry =
          Not Shared). Accounts onboarded this quarter are New and are left out of Adherence.
        </p>
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSkip(0);
        }}
        showPeriod={false}
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
            <option value={CUSTOMER_REPORT_STATUSES.new}>New</option>
          </NativeSelect>
        </div>
      </ProjectHealthFilterBar>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Adherence" value={adherence === null ? "—" : `${adherence}%`} accentClassName="border-t-[#1a6fc4]" />
        <StatTile label="Shared with Customer" value={kpi?.shared_count ?? "—"} accentClassName="border-t-emerald-500" />
        <StatTile label="Not Shared" value={kpi?.not_shared_count ?? "—"} accentClassName="border-t-red-500" />
        <StatTile label="New (not counted)" value={kpi?.new_count ?? "—"} accentClassName="border-t-slate-400" />
      </div>

      {isError ? (
        <ErrorBlock title="Couldn't load customer account reporting." error={error} onRetry={() => refetch()} />
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
              placeholder="Search accounts…"
              className="w-full max-w-sm rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#1a6fc4] focus:outline-none"
            />
            <ProjectHealthExportButton
              filename="project-health-customer-account-reports"
              columns={columns}
              fetchAll={() =>
                fetchAllProjectHealthRows<Row>(PROJECT_HEALTH_LIST_PATHS.customerAccountReports, { ...listParams })
              }
            />
          </div>
          <RegisterTable
            items={rows}
            columns={columns}
            emptyLabel={isLoading ? "Loading…" : "No accounts match this selection."}
          />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
