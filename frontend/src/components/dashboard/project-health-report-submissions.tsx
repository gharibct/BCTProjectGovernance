"use client";

import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { useProjectHealthDashboardSummary, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import {
  fetchAllProjectHealthRows,
  PROJECT_HEALTH_LIST_PATHS,
  REPORT_SUBMISSION_STREAMS,
  useProjectHealthReportSubmissions,
  type ReportSubmissionDetailRow,
  type ReportSubmissionStreamKey,
} from "@/lib/api/project-health-lists";
import { ProjectHealthExportButton } from "./project-health-export-button";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { BackToProjectHealth, ErrorBlock, formatDate, StatTile } from "./project-health-kpi";

const PAGE_SIZE = 15;

type Row = ReportSubmissionDetailRow & { id: string };

type StatusFilter = "all" | "pending" | "submitted";

// Columns carrying a dimension that is always blank for a given stream — hidden
// on that stream's KPI-scoped sub screen so the grid isn't mostly em dashes.
const SCOPED_HIDDEN_COLUMNS: Record<ReportSubmissionStreamKey, string[]> = {
  "delivery-status-projects": [],
  "metrics-projects": [],
  "delivery-status-account": ["project_label", "project_manager_name"],
  "delivery-status-geo": ["project_label", "project_manager_name", "account_name", "account_head_name"],
};

function StatusPill({ value }: { value: string }) {
  const submitted = value === "Submitted";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1",
        submitted ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200",
      )}
    >
      {value}
    </span>
  );
}

const dash = (value: string | null | undefined) => (value && value.trim() ? value : "—");

// Shared by the combined "Report Submissions" screen (no `kpi`) and its four
// KPI-scoped sub screens. A `kpi` narrows the grid to one report stream, seeds
// the status filter to Pending (the "who hasn't filed" rows), and swaps the
// heading + stat tiles for that stream.
export function ProjectHealthReportSubmissions({ kpi }: { kpi?: ReportSubmissionStreamKey }) {
  const stream = kpi ? REPORT_SUBMISSION_STREAMS[kpi] : null;

  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({});
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>(stream ? "pending" : "all");
  const [skip, setSkip] = React.useState(0);

  const pending = statusFilter === "all" ? undefined : statusFilter === "pending";
  const listParams = {
    ...filters,
    reportType: stream?.reportType,
    pending,
  };

  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const { data, isLoading, isError, error, refetch } = useProjectHealthReportSubmissions({
    ...listParams,
    skip,
    limit: PAGE_SIZE,
  });

  const allColumns: RegisterColumn<Row>[] = [
    { key: "report_type", label: "Report" },
    { key: "geo_name", label: "Geo", render: (row) => dash(row.geo_name), excelValue: (row) => row.geo_name ?? "" },
    { key: "account_name", label: "Account", render: (row) => dash(row.account_name), excelValue: (row) => row.account_name ?? "" },
    { key: "project_label", label: "Project", render: (row) => dash(row.project_label), excelValue: (row) => row.project_label ?? "" },
    { key: "project_manager_name", label: "PM", render: (row) => dash(row.project_manager_name), excelValue: (row) => row.project_manager_name ?? "" },
    { key: "account_head_name", label: "Account Head", render: (row) => dash(row.account_head_name), excelValue: (row) => row.account_head_name ?? "" },
    { key: "geo_head_name", label: "Geo Head", render: (row) => dash(row.geo_head_name), excelValue: (row) => row.geo_head_name ?? "" },
    { key: "period_label", label: "Period" },
    { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} />, excelValue: (row) => row.status },
    {
      key: "submission_date",
      label: "Submission Date",
      render: (row) => formatDate(row.submission_date),
      excelValue: (row) => row.submission_date ?? "",
    },
  ];

  const hidden = kpi ? SCOPED_HIDDEN_COLUMNS[kpi] : [];
  const columns = allColumns.filter((c) => !(stream && (c.key === "report_type" || hidden.includes(c.key))));

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.row_key }));

  const rs = summary?.report_submissions;
  const streamKpi = stream && rs ? rs[stream.summaryKey] : null;
  const pendingCount = streamKpi ? Math.max(streamKpi.expected_count - streamKpi.submitted_count, 0) : null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {stream ? stream.heading : "Report Submissions"}
        </h1>
        <p className="text-slate-500">
          {stream
            ? "Reporting periods this stream owed since onboarding — pending (not yet filed) by default."
            : "Every delivery-status and metrics report owed by a project, account, or geo since it was onboarded — filed or not."}
        </p>
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSkip(0);
        }}
        showPeriod={false}
        extraFiltersActive={stream ? statusFilter !== "pending" : false}
        onReset={
          stream
            ? () => {
                setStatusFilter("pending");
                setSkip(0);
              }
            : undefined
        }
      >
        {stream ? (
          <div className="w-52">
            <NativeSelect
              aria-label="Submission status"
              className="h-9 bg-white text-sm"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setSkip(0);
              }}
            >
              <option value="pending">Pending (Not Submitted)</option>
              <option value="submitted">Submitted</option>
              <option value="all">All</option>
            </NativeSelect>
          </div>
        ) : null}
      </ProjectHealthFilterBar>

      {stream ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            label="Adherence"
            value={streamKpi ? `${streamKpi.adherence_pct}%` : "—"}
            accentClassName="border-t-[#1a6fc4]"
          />
          <StatTile
            label="Reports Owed"
            value={streamKpi ? streamKpi.expected_count : "—"}
            accentClassName="border-t-indigo-500"
          />
          <StatTile label="Pending" value={pendingCount ?? "—"} accentClassName="border-t-amber-500" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="Delivery Status — Projects"
            value={rs ? `${rs.delivery_status_projects.adherence_pct}%` : "—"}
            accentClassName="border-t-[#1a6fc4]"
          />
          <StatTile
            label="Metrics — Projects"
            value={rs ? `${rs.metrics_projects.adherence_pct}%` : "—"}
            accentClassName="border-t-indigo-500"
          />
          <StatTile
            label="Delivery Status — Account"
            value={rs ? `${rs.delivery_status_accounts.adherence_pct}%` : "—"}
            accentClassName="border-t-emerald-500"
          />
          <StatTile
            label="Delivery Status — Geo"
            value={rs ? `${rs.delivery_status_geos.adherence_pct}%` : "—"}
            accentClassName="border-t-amber-500"
          />
        </div>
      )}

      {isError ? (
        <ErrorBlock title="Couldn't load report submissions." error={error} onRetry={() => refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-end">
            <ProjectHealthExportButton
              filename={stream ? `project-health-report-submissions-${kpi}` : "project-health-report-submissions"}
              columns={columns}
              fetchAll={() =>
                fetchAllProjectHealthRows<Row>(PROJECT_HEALTH_LIST_PATHS.reportSubmissions, { ...listParams })
              }
            />
          </div>
          <RegisterTable
            items={rows}
            columns={columns}
            emptyLabel={
              isLoading
                ? "Loading…"
                : stream
                  ? "No reports match this filter."
                  : "No reports owed for the current scope."
            }
          />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}
    </div>
  );
}
