"use client";

import { useProjectHealthFilters, useScreenFilters } from "@/stores/project-health-filters";
import * as React from "react";
import { FileDown, LayoutGrid, Users } from "lucide-react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { cn } from "@/lib/utils";
import { useProjectHealthDashboardSummary } from "@/lib/api/project-health-dashboard";
import {
  formatGeoRegion,
  QBR_REPORT_STATUSES,
  useProjectHealthCustomerAccountReports,
  type CustomerAccountReportRow,
  type QbrReportStatus,
} from "@/lib/api/project-health-lists";
import { bubbleClass } from "./high-risks";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { AccentSection, BackToProjectHealth, Card, ErrorBlock, formatDate, RagFilterTiles } from "./project-health-kpi";
import { downloadCustomerCommunicationFile } from "@/lib/api/customer-communications";
import { usePageBanner } from "@/stores/page-banner";

const PAGE_SIZE = 10;

// Every column but Account uses small text so the Account cell gets the room.
const COMPACT = "px-3 text-xs";
const QUARTER = "min-w-[110px] px-3 text-center text-xs";
// Quarter and Last QBR headers in a smaller font.
const QUARTER_HEADER = "text-[10px]";
// Current QBR Status and the current / next quarter columns are tinted like their tiles on Update Account QBR.
const CURRENT_TINT = "bg-[#E8F2FC]";
const CURRENT_QUARTER = `${QUARTER} ${CURRENT_TINT}`;
const NEXT_QUARTER = `${QUARTER} bg-amber-50`;

// "2 conducted" / "1 planned" — the number in bold so it reads at a glance.
function QbrCount({ value, label }: { value: number; label: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-bold text-slate-900 tabular-nums">{value}</span> {label}
    </span>
  );
}

type Row = CustomerAccountReportRow & { id: string };

// Not Planned red; Initiated / Scheduled / Conducted from very light to dark green.
const STATUS_TONE: Record<QbrReportStatus, string> = {
  Conducted: "bg-green-700 text-white ring-green-800",
  Scheduled: "bg-green-200 text-green-900 ring-green-300",
  Initiated: "bg-green-50 text-green-800 ring-green-200",
  "Not Planned": "bg-red-50 text-red-700 ring-red-200",
};

function StatusPill({ value }: { value: QbrReportStatus }) {
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


// Drill-down behind the dashboard's Account QBR Reporting card: one row per
// critical active account with the status of its QBR in the calendar quarter
// (today's date; no QBR in the quarter = Not Planned). Laid out like
// View DE Assessments: clickable status tiles, and Geo / Region chips on the
// account cell that narrow the page filters.
// `standalone` = the left-menu Account QBR Dashboard (CXO / Geo Head / DM): same grid,
// its own title and no GovOne breadcrumb — like High Risk vs the GovOne Account RAG.
export function ProjectHealthCustomerAccountReports({ standalone = false }: { standalone?: boolean }) {
  const [filters, setFilters] = useProjectHealthFilters();
  const [search, setSearch] = React.useState("");
  const [skip, setSkip] = React.useState(0);
  // The status tile picked below — narrows the list to that status.
  const { overall: status, setOverall: setStatus, reset: resetStatus } = useScreenFilters("account-qbr");

  const listParams = { ...filters, status: status || undefined, search: search || undefined };
  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const { data, isLoading, isError, error, refetch } = useProjectHealthCustomerAccountReports({
    ...listParams,
    skip,
    limit: PAGE_SIZE,
  });
  const kpi = summary?.customer_account_reports;
  const showError = usePageBanner((state) => state.showError);
  const previousLabels = kpi?.previous_quarter_labels ?? ["—", "—", "—"];

  const chip = (title: string, label: string, apply: () => void) => (
    <button
      type="button"
      className={bubbleClass}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        apply();
        setSkip(0);
      }}
    >
      {label}
    </button>
  );

  const columns: RegisterColumn<Row>[] = [
    {
      key: "account_name",
      label: "Account",
      className: "w-[30%] min-w-[260px]",
      render: (row) => (
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-slate-900">{row.account_name}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {row.geo_name
              ? chip("Filter by this geo", row.geo_name, () =>
                  setFilters((f) => ({ ...f, geoId: row.geo_id ?? undefined, regionId: undefined, accountId: undefined })),
                )
              : null}
            {row.region_name
              ? chip("Filter by this region", row.region_name, () =>
                  setFilters((f) => ({
                    ...f,
                    geoId: row.geo_id ?? f.geoId,
                    regionId: row.region_id ?? undefined,
                    accountId: undefined,
                  })),
                )
              : null}
            <span className="text-xs font-normal text-slate-500">DM: {row.account_head_name ?? "—"}</span>
          </div>
          <span className="text-xs font-normal text-slate-500">Geo Head: {row.geo_head_name ?? "—"}</span>
        </div>
      ),
      // The export keeps Geo - Region, DM and Geo Head in the account cell's text.
      excelValue: (row) =>
        [
          row.account_name,
          formatGeoRegion(row.geo_name, row.region_name),
          `DM: ${row.account_head_name ?? "—"}`,
          `Geo Head: ${row.geo_head_name ?? "—"}`,
        ].join(" | "),
    },
    { key: "status", label: "Current QBR Status", className: `${COMPACT} ${CURRENT_TINT}`, render: (row) => <StatusPill value={row.status} />, excelValue: (row) => row.status },
    ...previousLabels.map(
      (label, i): RegisterColumn<Row> => ({
        key: `previous_${i}`,
        label,
        subLabel: "Previous Quarter",
        headerClassName: QUARTER_HEADER,
        className: QUARTER,
        render: (row) => <QbrCount value={row.previous_quarters_conducted[i] ?? 0} label="conducted" />,
        excelValue: (row) => `${row.previous_quarters_conducted[i] ?? 0} conducted`,
      }),
    ),
    {
      key: "current_quarter",
      label: kpi?.quarter_label ?? "—",
      subLabel: "Current Quarter",
      headerClassName: QUARTER_HEADER,
      className: CURRENT_QUARTER,
      render: (row) => (
        <div className="flex flex-col items-center gap-0.5">
          <QbrCount value={row.current_quarter_conducted} label="conducted" />
          <QbrCount value={row.current_quarter_planned} label="planned" />
        </div>
      ),
      excelValue: (row) => `${row.current_quarter_conducted} conducted, ${row.current_quarter_planned} planned`,
    },
    {
      key: "next_quarter_open_count",
      label: kpi?.next_quarter_label ?? "—",
      subLabel: "Next Quarter",
      headerClassName: QUARTER_HEADER,
      className: NEXT_QUARTER,
      render: (row) => <QbrCount value={row.next_quarter_open_count} label="planned" />,
      excelValue: (row) => `${row.next_quarter_open_count} planned`,
    },
    {
      key: "last_qbr_date",
      label: "Last QBR Date",
      className: COMPACT,
      headerClassName: QUARTER_HEADER,
      render: (row) => formatDate(row.last_qbr_date),
      excelValue: (row) => row.last_qbr_date ?? "",
    },
    {
      key: "last_qbr_title",
      label: "Last QBR Presentation",
      className: COMPACT,
      headerClassName: QUARTER_HEADER,
      render: (row) =>
        row.last_qbr_id && row.last_qbr_file_name ? (
          <button
            type="button"
            title={`Download ${row.last_qbr_file_name}`}
            onClick={(e) => {
              e.stopPropagation();
              downloadCustomerCommunicationFile(row.account_id, {
                id: row.last_qbr_id!,
                file_name: row.last_qbr_file_name,
              }).catch((err) => showError(err instanceof Error ? err.message : "Failed to download the presentation."));
            }}
            className="inline-flex items-center gap-1 text-left text-xs font-semibold text-[#1a6fc4] hover:underline"
          >
            <FileDown className="size-3.5 shrink-0" />
            {row.last_qbr_title || row.last_qbr_file_name}
          </button>
        ) : (
          <span className="text-slate-400">—</span>
        ),
      excelValue: (row) => row.last_qbr_title ?? row.last_qbr_file_name ?? "",
    },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.account_id }));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="flex flex-col gap-2">
        {standalone ? null : <BackToProjectHealth current="Account QBR Reporting" />}
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {standalone ? "Account QBR Dashboard" : "Account QBR Reporting"}
        </h1>
        <p className="text-slate-500">
          The QBR status of each critical active account for the current quarter (no QBR in the quarter =
          Not Planned).
        </p>
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSkip(0);
        }}
        // QBRs always follow the current quarter (today), so no Period filter.
        showPeriod={false}
        extraFiltersActive={!!status || !!search}
        onReset={() => {
          resetStatus();
          setSearch("");
          setSkip(0);
        }}
      >
        <div className="w-56">
          <input
            type="text"
            aria-label="Search accounts"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSkip(0);
            }}
            placeholder="Search accounts…"
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-[#1a6fc4] focus:outline-none"
          />
        </div>
      </ProjectHealthFilterBar>

      <Card
        title="Account QBR Status"
        icon={Users}
        iconClassName="text-[#1a6fc4]"
        period={`Current Quarter: ${kpi?.quarter_label ?? "current quarter"}`}
      >
        <RagFilterTiles
          buckets={QBR_REPORT_STATUSES}
          counts={{
            Conducted: kpi?.conducted_count,
            Scheduled: kpi?.scheduled_count,
            Initiated: kpi?.initiated_count,
            "Not Planned": kpi?.not_planned_count,
          }}
          selected={status}
          onSelect={(bucket) => {
            setStatus(bucket);
            setSkip(0);
          }}
        />
      </Card>

      {isError ? (
        <ErrorBlock title="Couldn't load Account QBR reporting." error={error} onRetry={() => refetch()} />
      ) : (
        <AccentSection
          icon={LayoutGrid}
          heading={kpi?.quarter_label ? `Accounts — ${kpi.quarter_label}` : "Accounts"}
        >
          <RegisterTable flush items={rows} columns={columns} emptyLabel={isLoading ? "Loading…" : "No accounts match this selection."} />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </AccentSection>
      )}
    </div>
  );
}
