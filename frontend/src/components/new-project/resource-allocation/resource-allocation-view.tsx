"use client";

import * as React from "react";
import { Eye, Search } from "lucide-react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useResourceAllocationDetail,
  useResourceAllocations,
  useResourceAllocationSummary,
  type ResourceAllocationRow,
} from "@/lib/api/oracle-resource-allocation";
import { useNewProjectId } from "@/stores/new-project-ui";

const PAGE_SIZE = 10;

type Row = ResourceAllocationRow & { id: string };

// "2026-02-02" -> "02 Feb 2026". Parsed by hand so a date-only value never
// shifts a day through a timezone conversion.
function formatIsoDate(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Man-months are decimals sent as strings ("1.0000").
function formatManMonths(value: string | null | undefined): string {
  return Number(value ?? 0).toFixed(2);
}

function KpiTile({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="rounded-xl border border-t-4 border-slate-200 border-t-[#1a6fc4] bg-white p-5 shadow-sm">
      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

// Project Setup / Amend Project → Resource Allocation. Shows who Oracle has
// allocated to the project's mapped Oracle projects: two KPIs, two searchable /
// paginated resource grids (current month / old), and a right drawer with one resource's month-wise
// allocation. Read-only — allocations are maintained in Oracle.
export function ResourceAllocationView() {
  const projectId = useNewProjectId();
  const [selected, setSelected] = React.useState<Row | null>(null);

  const summary = useResourceAllocationSummary(projectId);

  if (summary.isError) {
    return <QueryErrorState error={summary.error} onRetry={() => summary.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiTile
          label="Resources Allocated This Month"
          value={summary.data ? summary.data.resources_allocated_this_month : "—"}
          hint="Allocation overlaps the current month"
        />
        <KpiTile
          label="Man Months Consumed Till Date"
          value={summary.data ? formatManMonths(summary.data.man_months_consumed) : "—"}
          hint="Across all loaded months"
        />
      </div>

      <AllocationGrid
        projectId={projectId}
        scope="current"
        title="Current Month Allocations"
        emptyLabel="No resources are allocated to the mapped Oracle projects this month."
        onSelect={setSelected}
      />
      <AllocationGrid
        projectId={projectId}
        scope="old"
        title="Old Allocations"
        emptyLabel="No old allocations found for the mapped Oracle projects."
        onSelect={setSelected}
      />

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        {selected ? <AllocationDrawer projectId={projectId} row={selected} /> : null}
      </Sheet>
    </div>
  );
}

// One searchable / paginated resource grid; the page renders two of them —
// resources allocated in the current month, and everyone else ("old").
function AllocationGrid({
  projectId,
  scope,
  title,
  emptyLabel,
  onSelect,
}: {
  projectId: string | null;
  scope: "current" | "old";
  title: string;
  emptyLabel: string;
  onSelect: (row: Row) => void;
}) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [skip, setSkip] = React.useState(0);

  const list = useResourceAllocations(projectId, { search: debouncedSearch, skip, limit: PAGE_SIZE, scope });

  const rows: Row[] = React.useMemo(
    () => (list.data?.items ?? []).map((item) => ({ ...item, id: item.employee_id })),
    [list.data]
  );

  const columns: RegisterColumn<Row>[] = [
    {
      key: "employee_name",
      label: "Resource",
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.employee_name ?? "—"}</p>
          <p className="text-xs text-slate-500">
            {row.employee_code}
            {row.location ? ` · ${row.location}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "oracle_project_ids",
      label: "Oracle Project ID",
      render: (row) => (row.oracle_project_ids.length ? row.oracle_project_ids.join(", ") : "—"),
    },
    {
      key: "allocation_start_date",
      label: "Allocation Start Date",
      render: (row) => formatIsoDate(row.allocation_start_date),
    },
    {
      key: "allocation_end_date",
      label: "Allocation End Date",
      render: (row) => formatIsoDate(row.allocation_end_date, "Open-ended"),
    },
    {
      key: "total_man_months",
      label: "Total Man Months Allocated",
      align: "right",
      render: (row) => formatManMonths(row.total_man_months),
    },
    {
      key: "view",
      label: "",
      align: "right",
      render: (row) => (
        <Button
          variant="outline"
          className="h-8 gap-1.5 px-3 text-xs font-semibold"
          aria-label={`View month-wise allocation for ${row.employee_name ?? row.employee_code}`}
          onClick={() => onSelect(row)}
        >
          <Eye className="size-3.5" />
          View
        </Button>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900">
          {title}
          {list.data ? <span className="ml-2 text-sm font-medium text-slate-400">({list.data.total})</span> : null}
        </h2>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSkip(0);
            }}
            placeholder="Search by resource name…"
            aria-label={`Search ${title.toLowerCase()} by resource name`}
            className="w-full rounded-md border border-slate-200 py-2 pr-3 pl-9 text-sm focus:border-[#1a6fc4] focus:outline-none"
          />
        </div>
      </div>

      {list.isError ? (
        <QueryErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          <RegisterTable
            items={rows}
            columns={columns}
            emptyLabel={list.isLoading ? "Loading…" : debouncedSearch.trim() ? "No resources match your search." : emptyLabel}
          />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={list.data?.total ?? 0} onPageChange={setSkip} />
        </>
      )}
    </section>
  );
}

function AllocationDrawer({ projectId, row }: { projectId: string | null; row: Row }) {
  const detail = useResourceAllocationDetail(projectId, row.employee_id);
  const data = detail.data;

  return (
    <SheetContent className="gap-0 p-0">
      <SheetHeader>
        <SheetTitle>{row.employee_name ?? row.employee_code}</SheetTitle>
        <SheetDescription>
          {row.employee_code}
          {row.location ? ` · ${row.location}` : ""} — month-wise allocation
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-6">
        {detail.isError ? (
          <QueryErrorState error={detail.error} onRetry={() => detail.refetch()} />
        ) : !data ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="flex flex-col gap-6">
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Allocation periods</h3>
              <ul className="flex flex-col gap-2">
                {data.periods.map((period) => (
                  <li
                    key={period.allocation_start_date}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-700">
                      {formatIsoDate(period.allocation_start_date)} –{" "}
                      {formatIsoDate(period.allocation_end_date, "Open-ended")}
                    </span>
                    {period.percentage_allocation ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                        {Number(period.percentage_allocation)}%
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Man months by month</h3>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#8EBBE0] bg-[#D6E9F8] text-left text-xs font-bold tracking-wide text-[#205889] uppercase">
                      <th className="px-4 py-3">Month</th>
                      <th className="px-4 py-3 text-right">Man Months</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.months.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                          No monthly allocation has been loaded yet.
                        </td>
                      </tr>
                    ) : (
                      data.months.map((month) => (
                        <tr key={month.month_start}>
                          <td className="px-4 py-2.5 text-slate-700">{month.month}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                            {formatManMonths(month.man_month)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data.months.length > 0 ? (
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50 font-bold text-slate-900">
                        <td className="px-4 py-3">Total</td>
                        <td className="px-4 py-3 text-right">{formatManMonths(data.total_man_months)}</td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </SheetContent>
  );
}
