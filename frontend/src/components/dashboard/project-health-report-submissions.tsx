"use client";

import { useProjectHealthFilters, useScreenFilters } from "@/stores/project-health-filters";
import { readReturnSkip, useReturnToRow } from "@/lib/return-to-row";
import * as React from "react";
import Link from "next/link";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectHealthDashboardSummary } from "@/lib/api/project-health-dashboard";
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
import {
  BackToProjectHealth,
  Card,
  ErrorBlock,
  formatDate,
  RAG_BUCKET_STYLES,
  RagCountCell,
  RagFilterTiles,
  StatTile,
  type RagBucket,
} from "./project-health-kpi";
import { ACCOUNT_MANAGER_LABEL } from "@/lib/role-labels";
import { useEffectiveRole } from "@/stores/session";

const PAGE_SIZE = 15;

type Row = ReportSubmissionDetailRow & { id: string };

// Columns carrying a dimension that is always blank for a given stream — hidden
// on that stream's KPI-scoped sub screen so the grid isn't mostly em dashes.
const SCOPED_HIDDEN_COLUMNS: Record<ReportSubmissionStreamKey, string[]> = {
  "delivery-status-projects": [],
  "metrics-projects": [],
  "delivery-status-account": ["project_label", "project_manager_name"],
  "delivery-status-geo": ["project_label", "project_manager_name", "account_name", "account_head_name"],
};

const PILL_TONE: Record<string, string> = {
  Approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Baselined: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Submitted: "bg-blue-50 text-blue-700 ring-blue-200",
  "Auto Generated": "bg-slate-50 text-slate-500 ring-slate-200",
};

// Statuses that mean a report exists to open (anything else is still owed).
const FILED_STATUSES = new Set(["Submitted", "Approved", "Baselined"]);

function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1",
        PILL_TONE[value] ?? "bg-red-50 text-red-700 ring-red-200",
      )}
    >
      {value}
    </span>
  );
}

// Per stream: the card title (as on the GovOne Dashboard), the clickable
// buckets, and the one pre-selected when the page opens ("who hasn't filed").
const STREAM_TILES: Record<ReportSubmissionStreamKey, { title: string; buckets: RagBucket[]; defaultBucket: RagBucket }> = {
  "delivery-status-projects": {
    title: "Delivery Status \u2014 Projects",
    buckets: ["Not Submitted", "Submitted", "Approved"],
    defaultBucket: "Not Submitted",
  },
  "delivery-status-account": {
    title: "Delivery Status \u2014 Account",
    buckets: ["Not Submitted", "Submitted", "Approved"],
    defaultBucket: "Not Submitted",
  },
  "delivery-status-geo": {
    title: "Delivery Status \u2014 Geo",
    buckets: ["Not Baselined", "Baselined", "Auto Generated"],
    defaultBucket: "Not Baselined",
  },
  "metrics-projects": {
    title: "Project Performance",
    buckets: ["Not Submitted", "Submitted"],
    defaultBucket: "Not Submitted",
  },
};

// The same counts the dashboard card shows, from the summary.
function bucketCounts(
  kpi: ReportSubmissionStreamKey,
  k: { submitted_count: number; expected_count: number; approved_count: number; auto_generated_count: number } | null,
): Partial<Record<RagBucket, number>> {
  if (!k) return {};
  const notFiled = Math.max(k.expected_count - k.submitted_count, 0);
  if (kpi === "delivery-status-geo") {
    return {
      "Not Baselined": Math.max(notFiled - k.auto_generated_count, 0),
      Baselined: k.submitted_count,
      "Auto Generated": k.auto_generated_count,
    };
  }
  if (kpi === "metrics-projects") return { "Not Submitted": notFiled, Submitted: k.submitted_count };
  return {
    "Not Submitted": notFiled,
    Submitted: Math.max(k.submitted_count - k.approved_count, 0),
    Approved: k.approved_count,
  };
}

// Stored selection: "" = not touched (use the stream's default), ALL = the user
// clicked the selected tile again to see every row.
const ALL = "__all__";

const dash = (value: string | null | undefined) => (value && value.trim() ? value : "—");

// Where "View" on a Submitted row opens the actual report content — the
// read-only viewer routes (project-review / account-review / geo-review /
// project-performance), not the PM's own editable Reporting Hub. Those
// viewers have no PM reporting nav rail (see status-review-page.tsx /
// project-performance-page.tsx), which fits a cross-portfolio drill-down
// grid better than the hub's full edit-checklist nav. `backPath` rides
// along as `?back=` so the report screen's breadcrumb can point back here
// instead of its usual default — see those components' `back` handling.
function reportHref(row: Row, backPath: string): string | null {
  const back = `&back=${encodeURIComponent(backPath)}`;
  switch (row.report_type) {
    case "Delivery Status - Project":
      return `/project-review/${row.entity_id}?period=${row.period_id}${back}`;
    case "Metrics - Project":
      return `/project-performance/${row.entity_id}?period=${row.period_id}${back}`;
    case "Delivery Status - Account":
      return `/account-review/${row.entity_id}?period=${row.period_id}${back}`;
    case "Delivery Status - Geo":
      return `/geo-review/${row.entity_id}?period=${row.period_id}${back}`;
    default:
      return null;
  }
}

// Shared by the combined "Report Submissions" screen (no `kpi`) and its four
// KPI-scoped sub screens. A `kpi` narrows the grid to one report stream, seeds
// the status filter to Pending (the "who hasn't filed" rows), and swaps the
// heading + stat tiles for that stream.
export function ProjectHealthReportSubmissions({ kpi }: { kpi?: ReportSubmissionStreamKey }) {
  const stream = kpi ? REPORT_SUBMISSION_STREAMS[kpi] : null;
  // Geo Delivery Status reports belong to Geo Heads and above.
  const showGeoTile = useEffectiveRole() !== "ACCOUNT_MANAGER";
  const backPath = stream ? stream.route : "/project-health/report-submissions";

  const [filters, setFilters] = useProjectHealthFilters();
  // Stream screens: the KPI bucket picked on the tiles ("" = the stream's default).
  const { overall: picked, setOverall: setPicked, reset: resetPicked } = useScreenFilters(kpi ?? "report-submissions");

  // Back from a report: reopen the same page of results, focused on the clicked row.
  const returnKey = kpi ?? "report-submissions";
  const [skip, setSkip] = React.useState(() => readReturnSkip(returnKey));
  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const tiles = kpi ? STREAM_TILES[kpi] : null;
  const bucket = tiles ? (picked === ALL ? undefined : picked || tiles.defaultBucket) : undefined;
  // Stream screens list the selected week's rows (the ones the card counts); the
  // combined screen keeps the all-periods history.
  const periodId = filters.periodId ?? summary?.period_id ?? undefined;
  const listParams = {
    ...filters,
    periodId: stream ? periodId : undefined,
    reportType: stream?.reportType,
    status: bucket,
  };

  const { data, isLoading, isError, error, refetch } = useProjectHealthReportSubmissions(
    {
      ...listParams,
      skip,
      limit: PAGE_SIZE,
    },
    { enabled: !stream || !!periodId },
  );

  const allColumns: RegisterColumn<Row>[] = [
    { key: "report_type", label: "Report" },
    { key: "geo_name", label: "Geo", render: (row) => dash(row.geo_name), excelValue: (row) => row.geo_name ?? "" },
    { key: "account_name", label: "Account", render: (row) => dash(row.account_name), excelValue: (row) => row.account_name ?? "" },
    { key: "project_label", label: "Project", render: (row) => dash(row.project_label), excelValue: (row) => row.project_label ?? "" },
    { key: "project_manager_name", label: "PM", render: (row) => dash(row.project_manager_name), excelValue: (row) => row.project_manager_name ?? "" },
    { key: "account_head_name", label: ACCOUNT_MANAGER_LABEL, render: (row) => dash(row.account_head_name), excelValue: (row) => row.account_head_name ?? "" },
    { key: "geo_head_name", label: "Geo Head", render: (row) => dash(row.geo_head_name), excelValue: (row) => row.geo_head_name ?? "" },
    { key: "period_label", label: "Period" },
    { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} />, excelValue: (row) => row.status },
    {
      key: "submission_date",
      label: "Submission Date",
      render: (row) => formatDate(row.submission_date),
      excelValue: (row) => row.submission_date ?? "",
    },
    {
      key: "view",
      label: "",
      excelValue: () => "",
      render: (row) => {
        if (!FILED_STATUSES.has(row.status)) return null;
        const href = reportHref(row, backPath);
        return href ? (
          <Link href={href} className="text-sm font-semibold text-[#1a6fc4] hover:underline">
            View
          </Link>
        ) : null;
      },
    },
  ];

  const hidden = kpi ? SCOPED_HIDDEN_COLUMNS[kpi] : [];
  const columns = allColumns.filter((c) => !(stream && (c.key === "report_type" || hidden.includes(c.key))));

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.row_key }));
  const { onClickCapture } = useReturnToRow(returnKey, !isLoading && rows.length > 0, skip);

  const rs = summary?.report_submissions;
  const streamKpi = stream && rs ? rs[stream.summaryKey] : null;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth current={stream ? stream.heading : "Report Submissions"} />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {stream ? stream.heading : "Report Submissions"}
        </h1>
        <p className="text-slate-500">
          {stream
            ? "The reports owed for the selected period \u2014 the same ones the GovOne Dashboard card counts."
            : "Every delivery-status and metrics report owed by a project, account, or geo since it was onboarded — filed or not."}
        </p>
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSkip(0);
        }}
        showPeriod={!!stream}
        extraFiltersActive={stream ? picked !== "" : false}
        onReset={
          stream
            ? () => {
                resetPicked();
                setSkip(0);
              }
            : undefined
        }
      />

      {stream && tiles ? (
        <Card
          title={tiles.title}
          icon={ClipboardCheck}
          iconClassName="text-slate-500"
          period={
            kpi === "metrics-projects"
              ? `Previous Month: ${summary?.previous_month_label ?? "\u2014"}`
              : `Selected Period: ${summary?.period_label ?? "current week"}`
          }
        >
          <RagFilterTiles
            buckets={tiles.buckets}
            counts={bucketCounts(kpi!, streamKpi)}
            selected={bucket ?? ""}
            redNotSubmitted
            onSelect={(next) => {
              setPicked(next === "" ? ALL : next);
              setSkip(0);
            }}
            leading={
              <RagCountCell
                label="Adherence"
                value={streamKpi ? `${streamKpi.adherence_pct}%` : "\u2014"}
                className={cn("py-2", RAG_BUCKET_STYLES["Not Assessed"].className)}
                valueClassName="text-2xl text-[#1a6fc4]"
              />
            }
          />
        </Card>
      ) : (
        <div className={cn("grid grid-cols-2 gap-4", showGeoTile ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
          <StatTile
            label="Delivery Status — Projects"
            value={rs ? `${rs.delivery_status_projects.adherence_pct}%` : "—"}
            accentClassName="border-t-[#1a6fc4]"
          />
          <StatTile
            label="Project Performance"
            value={rs ? `${rs.project_performance.adherence_pct}%` : "—"}
            accentClassName="border-t-indigo-500"
          />
          <StatTile
            label="Delivery Status — Account"
            value={rs ? `${rs.delivery_status_accounts.adherence_pct}%` : "—"}
            accentClassName="border-t-emerald-500"
          />
          {showGeoTile ? (
            <StatTile
              label="Delivery Status — Geo"
              value={rs ? `${rs.delivery_status_geos.adherence_pct}%` : "—"}
              accentClassName="border-t-amber-500"
            />
          ) : null}
        </div>
      )}

      {isError ? (
        <ErrorBlock title="Couldn't load report submissions." error={error} onRetry={() => refetch()} />
      ) : (
        <div onClickCapture={onClickCapture} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
