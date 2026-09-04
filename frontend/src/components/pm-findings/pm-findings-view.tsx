"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { StatusBadge } from "@/components/forms/status-badge";
import { ErrorBlock, formatDate, StatTile } from "@/components/dashboard/project-health-kpi";
import { cn } from "@/lib/utils";
import { canActOnPmFinding } from "@/lib/api/pm-findings-permissions";
import { useEffectiveRole } from "@/stores/session";
import {
  usePmFindings,
  usePmFindingsKpis,
  type DeFindingRow,
  type DeFindingsBucket,
  type DeFindingsKpis,
  type PmFindingsFilter,
} from "@/lib/api/pm-findings";
import { PmFindingsFilterBar } from "./pm-findings-filter-bar";
import { PmFindingsDrawer, type DrawerState } from "./pm-findings-drawer";

const PAGE_SIZE = 15;

type Row = DeFindingRow & { id: string };

type Tile = {
  label: string;
  read: (k: DeFindingsKpis) => number;
  bucket?: DeFindingsBucket;
  accent?: string;
};

const TILES: Tile[] = [
  { label: "Open Findings", read: (k) => k.open_findings },
  { label: "Overdue", read: (k) => k.overdue, bucket: "overdue", accent: "border-t-red-500" },
  { label: "Awaiting Closure", read: (k) => k.awaiting_closure, bucket: "awaiting_closure", accent: "border-t-indigo-500" },
  { label: "Closed This Period", read: (k) => k.closed_this_period, bucket: "closed_this_period", accent: "border-t-emerald-500" },
];

type Chip = { label: (k: DeFindingsKpis) => string; bucket: DeFindingsBucket };

const CHIPS: Chip[] = [
  { label: (k) => `${k.overdue_30d_count} Overdue >30 days`, bucket: "overdue_30d" },
  { label: (k) => `${k.awaiting_closure_count} Awaiting Closure`, bucket: "awaiting_closure" },
  { label: (k) => `${k.projects_over_5_open_count} Projects with >5 Open`, bucket: "projects_over_5_open" },
];

export function PmFindingsView() {
  const [filters, setFilters] = React.useState<PmFindingsFilter>({ status: "Active" });
  const [skip, setSkip] = React.useState(0);
  const [drawer, setDrawer] = React.useState<DrawerState | null>(null);

  const canAct = canActOnPmFinding(useEffectiveRole());

  const kpis = usePmFindingsKpis({ projectId: filters.projectId });
  const list = usePmFindings({ ...filters, skip, limit: PAGE_SIZE });

  const setBucket = (bucket?: DeFindingsBucket) => {
    setFilters((f) => ({ ...f, bucket: f.bucket === bucket ? undefined : bucket }));
    setSkip(0);
  };

  const rows: Row[] = (list.data?.items ?? []).map((r) => ({ ...r, id: r.id }));

  const columns: RegisterColumn<Row>[] = [
    {
      key: "seq",
      label: "Finding ID",
      render: (r) => <span className="font-mono font-semibold text-slate-900">#{r.sequence_no}</span>,
    },
    {
      key: "project_label",
      label: "Project",
      render: (r) => <span className="font-medium text-[#1a6fc4]">{r.project_label}</span>,
    },
    { key: "account_name", label: "Account" },
    {
      key: "description",
      label: "Finding",
      render: (r) => <span className="line-clamp-2 max-w-sm text-slate-600">{r.description || "—"}</span>,
    },
    { key: "category", label: "Category" },
    { key: "classification", label: "Classification" },
    // Assignee column is intentionally hidden: findings are always raised
    // against the project (owned by its PM), so there is no per-finding assignee
    // to show. The backend field/column is retained.
    { key: "due_date", label: "Due Date", render: (r) => formatDate(r.due_date) },
    {
      key: "age_days",
      label: "Age",
      render: (r) =>
        r.age_days == null ? (
          "—"
        ) : (
          <span className={r.overdue ? "font-medium text-red-600" : undefined}>{r.age_days} Days</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <div className="flex items-center gap-2">
          <StatusBadge value={r.status} />
          {r.overdue ? <span className="text-[10px] font-bold text-red-600">⚠ Overdue</span> : null}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">DE Findings</h1>
        <p className="mt-1 text-sm text-slate-500">DE findings raised on your projects</p>
      </header>

      <PmFindingsFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSkip(0);
        }}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {TILES.map((tile) => {
          const active = tile.bucket ? filters.bucket === tile.bucket : !filters.bucket;
          return (
            <button
              key={tile.label}
              type="button"
              onClick={() => (tile.bucket ? setBucket(tile.bucket) : setBucket(undefined))}
              className={cn(
                "rounded-xl text-left transition-shadow focus:outline-none",
                active ? "ring-2 ring-[#1a6fc4]" : "hover:shadow-md"
              )}
            >
              <StatTile
                label={tile.label}
                value={kpis.data ? tile.read(kpis.data) : "—"}
                accentClassName={tile.accent}
              />
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-red-600 uppercase">
          <AlertTriangle className="size-4" />
          Attention Required
        </span>
        {CHIPS.map((chip) => {
          const active = filters.bucket === chip.bucket;
          return (
            <button
              key={chip.bucket}
              type="button"
              onClick={() => setBucket(chip.bucket)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                active ? "bg-[#1a6fc4] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {kpis.data
                ? chip.label(kpis.data)
                : chip.label({
                    overdue_30d_count: 0,
                    awaiting_closure_count: 0,
                    projects_over_5_open_count: 0,
                  } as DeFindingsKpis)}
            </button>
          );
        })}
        {filters.bucket ? (
          <button
            type="button"
            onClick={() => setBucket(undefined)}
            className="text-xs font-semibold text-[#1a6fc4] hover:underline"
          >
            Clear filter
          </button>
        ) : null}
      </div>

      {list.isError ? (
        <ErrorBlock title="Couldn't load findings." error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <RegisterTable
            items={rows}
            columns={columns}
            emptyLabel={list.isLoading ? "Loading…" : "No findings found."}
            onRowClick={(r) => setDrawer({ findingId: r.id })}
          />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={list.data?.total ?? 0} onPageChange={setSkip} />
        </div>
      )}

      <PmFindingsDrawer
        state={drawer}
        rows={list.data?.items ?? []}
        canAct={canAct}
        onClose={() => setDrawer(null)}
      />
    </div>
  );
}
