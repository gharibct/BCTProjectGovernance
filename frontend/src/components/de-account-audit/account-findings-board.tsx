"use client";

import * as React from "react";
import { AlertTriangle, History, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Page } from "@/lib/api/client";
import { useAccounts, useGeos, useUsersByIds } from "@/lib/api/reference-data";
import { usePatchScope } from "@/hooks/use-patch-scope";
import { useEffectiveRole } from "@/stores/session";
import {
  FINDING_CLASSIFICATION_OPTIONS,
  FINDING_STATUS_OPTIONS,
  useAccountFindingHistory,
  type AccountFindingRow,
  type AccountFindingsBucket,
  type AccountFindingsFilter,
  type AccountFindingsKpis,
  type FindingHistoryEntry,
} from "@/lib/api/de-account-audit";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { StatusBadge } from "@/components/forms/status-badge";
import { ErrorBlock, formatDate, formatDateTime, StatTile } from "@/components/dashboard/project-health-kpi";

// Presentational findings register shared by DE Account Findings (the DE raises
// and closes) and Account Findings (the Delivery Manager records Action Taken).
// The two screens differ only in the hooks they call and the drawer body.

export const PAGE_SIZE = 15;

export type FindingsDrawerState = { mode: "create" } | { mode: "detail"; findingId: string };

type Tile = { label: string; read: (k: AccountFindingsKpis) => number; bucket?: AccountFindingsBucket; accent?: string };

const TILES: Tile[] = [
  { label: "Open Findings", read: (k) => k.open_findings },
  { label: "Overdue", read: (k) => k.overdue, bucket: "overdue", accent: "border-t-red-500" },
  { label: "Awaiting Closure", read: (k) => k.awaiting_closure, bucket: "awaiting_closure", accent: "border-t-indigo-500" },
  { label: "Closed This Period", read: (k) => k.closed_this_period, bucket: "closed_this_period", accent: "border-t-emerald-500" },
];

type Row = AccountFindingRow & Record<string, unknown>;

export function AccountFindingsBoard({
  title,
  subtitle,
  headerAction,
  filters,
  onFiltersChange,
  skip,
  onSkipChange,
  list,
  kpis,
  drawer,
  onDrawerChange,
  drawerTitle,
  renderDrawer,
}: {
  title: string;
  subtitle: string;
  headerAction?: React.ReactNode;
  filters: AccountFindingsFilter;
  onFiltersChange: (next: AccountFindingsFilter) => void;
  skip: number;
  onSkipChange: (skip: number) => void;
  list: { data?: Page<AccountFindingRow>; isLoading: boolean; isError: boolean; error: unknown; refetch: () => void };
  kpis?: AccountFindingsKpis;
  drawer: FindingsDrawerState | null;
  onDrawerChange: (next: FindingsDrawerState | null) => void;
  drawerTitle: (row: AccountFindingRow | null) => string;
  renderDrawer: (state: FindingsDrawerState, row: AccountFindingRow | null) => React.ReactNode;
}) {
  const rows = (list.data?.items ?? []) as Row[];

  // Geo / Account pickers: the full portfolio for DE / Admin / CXO, the user's
  // own patch for a Geo Head / Delivery Manager (the backend enforces it anyway).
  const role = useEffectiveRole();
  const { reportingAccounts, reportingGeos } = usePatchScope();
  const { data: allGeos = [] } = useGeos();
  const { data: allAccounts = [] } = useAccounts();
  const geos = role === "GEO_HEAD" ? reportingGeos : allGeos;
  const accounts = role === "ACCOUNT_MANAGER" ? reportingAccounts : allAccounts;
  const dirty =
    Boolean(filters.geoId || filters.accountId || filters.classification || filters.search || filters.bucket) ||
    filters.status !== "Active";
  const change = (patch: Partial<AccountFindingsFilter>) => {
    onFiltersChange({ ...filters, ...patch });
    onSkipChange(0);
  };
  const openRow =
    drawer?.mode === "detail" ? ((list.data?.items ?? []).find((r) => r.id === drawer.findingId) ?? null) : null;

  const setBucket = (bucket?: AccountFindingsBucket) => {
    onFiltersChange({ ...filters, bucket: filters.bucket === bucket ? undefined : bucket });
    onSkipChange(0);
  };

  const columns: RegisterColumn<Row>[] = [
    { key: "seq", label: "Finding ID", render: (r) => <span className="font-mono font-semibold text-slate-900">#{r.sequence_no}</span> },
    { key: "account_name", label: "Account", render: (r) => <span className="font-medium text-[#1a6fc4]">{r.account_name ?? "—"}</span> },
    {
      key: "description",
      label: "Finding",
      render: (r) => <span className="line-clamp-2 max-w-sm text-slate-600">{r.description || "—"}</span>,
    },
    { key: "category", label: "Category" },
    { key: "classification", label: "Classification" },
    { key: "due_date", label: "Due Date", render: (r) => formatDate(r.due_date) },
    {
      key: "age_days",
      label: "Age",
      render: (r) =>
        r.age_days == null ? "—" : <span className={r.overdue ? "font-medium text-red-600" : undefined}>{r.age_days} Days</span>,
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
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {headerAction}
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">Filters</span>
        <div className="relative min-w-[180px] flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            aria-label="Search findings"
            placeholder="Search account or finding…"
            value={filters.search ?? ""}
            onChange={(e) => change({ search: e.target.value || undefined })}
            className="h-9 pl-8"
          />
        </div>
        <div className="w-36 shrink-0">
          <NativeSelect
            aria-label="Geo"
            className="h-9 bg-white text-sm"
            value={filters.geoId ?? ""}
            onChange={(e) => change({ geoId: e.target.value || undefined, accountId: undefined })}
          >
            <option value="">Geo [All]</option>
            {geos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="w-44 shrink-0">
          <NativeSelect
            aria-label="Account"
            className="h-9 bg-white text-sm"
            value={filters.accountId ?? ""}
            onChange={(e) => change({ accountId: e.target.value || undefined })}
          >
            <option value="">Account [All]</option>
            {accounts
              .filter((a) => !filters.geoId || a.geo_id === filters.geoId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </NativeSelect>
        </div>
        <div className="w-40 shrink-0">
          <NativeSelect
            aria-label="Classification"
            className="h-9 bg-white text-sm"
            value={filters.classification ?? ""}
            onChange={(e) => change({ classification: e.target.value || undefined })}
          >
            <option value="">Classification [All]</option>
            {FINDING_CLASSIFICATION_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="w-40 shrink-0">
          <NativeSelect
            aria-label="Status"
            className="h-9 bg-white text-sm"
            value={filters.status ?? "All"}
            onChange={(e) => change({ status: e.target.value, bucket: undefined })}
          >
            <option value="Active">Active</option>
            {FINDING_STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
            <option value="All">All</option>
          </NativeSelect>
        </div>
        {dirty ? (
          <button
            type="button"
            onClick={() => change({ geoId: undefined, accountId: undefined, classification: undefined, search: undefined, bucket: undefined, status: "Active" })}
            className="ml-auto text-sm font-semibold text-[#1a6fc4] hover:underline"
          >
            Reset
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {TILES.map((tile) => {
          const active = tile.bucket ? filters.bucket === tile.bucket : !filters.bucket;
          return (
            <button
              key={tile.label}
              type="button"
              onClick={() => setBucket(tile.bucket)}
              className={cn(
                "rounded-xl text-left transition-shadow focus:outline-none",
                active ? "ring-2 ring-[#1a6fc4]" : "hover:shadow-md",
              )}
            >
              <StatTile label={tile.label} value={kpis ? tile.read(kpis) : "—"} accentClassName={tile.accent} />
            </button>
          );
        })}
      </div>

      {kpis && kpis.overdue > 0 ? (
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-red-600 uppercase">
          <AlertTriangle className="size-4" />
          {kpis.overdue} overdue finding{kpis.overdue === 1 ? "" : "s"} need attention
        </p>
      ) : null}

      {list.isError ? (
        <ErrorBlock title="Couldn't load findings." error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <RegisterTable
            items={rows}
            columns={columns}
            emptyLabel={list.isLoading ? "Loading…" : "No findings found."}
            onRowClick={(r) => onDrawerChange({ mode: "detail", findingId: r.id })}
          />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={list.data?.total ?? 0} onPageChange={onSkipChange} />
        </div>
      )}

      <Sheet open={drawer !== null} onOpenChange={(open) => (open ? null : onDrawerChange(null))}>
        <SheetContent className="gap-0 p-0">
          <SheetHeader>
            <SheetTitle>{drawerTitle(openRow)}</SheetTitle>
            <SheetDescription className="sr-only">Create a finding or review and update an existing one.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            {drawer ? (
              drawer.mode === "detail" && !openRow ? (
                <p className="p-6 text-sm text-slate-400">This finding is no longer in the list.</p>
              ) : (
                renderDrawer(drawer, openRow)
              )
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function describe(entry: FindingHistoryEntry): string {
  switch (entry.event_type) {
    case "CREATED":
      return "Finding raised";
    case "ACTION_TAKEN":
      return `Action recorded${entry.new_value ? ` — moved to ${entry.new_value}` : ""}`;
    case "STATUS_CHANGE":
      return `Status changed from ${entry.old_value ?? "—"} to ${entry.new_value ?? "—"}`;
    default:
      return entry.comment ?? "";
  }
}

// "Progress & History" — the append-only trail (de_account_finding_history).
export function AccountFindingHistory({ findingId, scope }: { findingId: string; scope: "de" | "owner" }) {
  const { data: entries = [] } = useAccountFindingHistory(findingId, scope);
  const { data: users = [] } = useUsersByIds(React.useMemo(() => entries.map((e) => e.created_by), [entries]));
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-5">
      <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
        <History className="size-4 text-slate-400" />
        Progress &amp; History
      </p>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-400">No history yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 text-xs">
              <span className="text-slate-700">{describe(entry)}</span>
              {entry.event_type === "ACTION_TAKEN" && entry.comment ? (
                <span className="text-slate-500 italic">“{entry.comment}”</span>
              ) : null}
              <span className="text-slate-400">
                {formatDateTime(entry.created_at)} · {users.find((u) => u.id === entry.created_by)?.full_name ?? "Unknown"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
