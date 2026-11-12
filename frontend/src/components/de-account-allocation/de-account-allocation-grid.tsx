"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import {
  useBulkAllocateDeAccount,
  useDeAccountAllocationList,
  type DeAccountAllocationFilter,
  type DeAccountAllocationRow,
  type DeAccountAssignment,
} from "@/lib/api/de-account-allocation";
import { canAllocateDe } from "@/lib/api/de-approval-permissions";
import { usePageBanner } from "@/stores/page-banner";
import { useSession } from "@/stores/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { PaginationBar } from "@/components/forms/pagination-bar";
import { ResourcePicker } from "@/components/forms/resource-picker";
import { StatCard } from "@/components/de-assessment-workspace/shared";

// DE Account Allocation — a DE (or Admin) assigns active accounts to a Delivery
// Excellence auditor, and can reassign or clear an allocation at any time. Not
// period-scoped and independent of the project-level DE allocation. The "Show"
// filter switches between accounts still awaiting a DE (the default), those
// already allocated, and all active accounts.

const VIEW_OPTIONS: { value: DeAccountAllocationFilter; label: string }[] = [
  { value: "unallocated", label: "Awaiting allocation" },
  { value: "allocated", label: "Already allocated" },
  { value: "all", label: "All accounts" },
];

const PAGE_SIZE = 10;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function DeAccountAllocationGrid() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const canWrite = canAllocateDe(user?.role.code);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const [view, setView] = React.useState<DeAccountAllocationFilter>("unallocated");
  const { data: rows = [], isLoading, isError, error, refetch } = useDeAccountAllocationList(view);

  const [search, setSearch] = React.useState("");
  const [geo, setGeo] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [critical, setCritical] = React.useState("");
  const [skip, setSkip] = React.useState(0);

  // Dirty per-row auditor overrides (accountId -> deUserId, null = clear).
  // A key being present means "changed in this session"; multi-select is separate.
  const [pending, setPending] = React.useState<Record<string, string | null>>({});
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkDe, setBulkDe] = React.useState<string | null>(null);

  const bulkAllocate = useBulkAllocateDeAccount();

  const geos = React.useMemo(
    () => [...new Set(rows.map((r) => r.geo_name).filter((v): v is string => !!v))].sort(),
    [rows],
  );
  const regions = React.useMemo(
    () => [...new Set(rows.map((r) => r.region_name).filter((v): v is string => !!v))].sort(),
    [rows],
  );

  const filteredRows = rows.filter((row) => {
    if (search && !row.account_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (geo && row.geo_name !== geo) return false;
    if (region && row.region_name !== region) return false;
    if (critical && row.critical_flag !== critical) return false;
    return true;
  });

  // Clamp in case rows shrink (e.g. after a save refetch) below the current page.
  const pageSkip = Math.min(skip, Math.max(0, Math.floor((filteredRows.length - 1) / PAGE_SIZE) * PAGE_SIZE));
  const pageRows = filteredRows.slice(pageSkip, pageSkip + PAGE_SIZE);

  const isChanged = (row: DeAccountAllocationRow) =>
    row.account_id in pending && pending[row.account_id] !== row.delivery_excellence_id;
  const auditorFor = (row: DeAccountAllocationRow): string | null =>
    row.account_id in pending ? pending[row.account_id] : row.delivery_excellence_id;

  const toggleRow = (accountId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === filteredRows.length ? new Set() : new Set(filteredRows.map((r) => r.account_id)),
    );
  };

  const applyBulk = () => {
    if (!bulkDe) return;
    setPending((prev) => {
      const next = { ...prev };
      for (const id of selected) next[id] = bulkDe;
      return next;
    });
    setSelected(new Set());
    setBulkDe(null);
  };

  const save = () => {
    const assignments: DeAccountAssignment[] = rows
      .filter(isChanged)
      .map((r) => ({ account_id: r.account_id, delivery_excellence_id: pending[r.account_id] }));
    if (assignments.length === 0) {
      showError("No allocation changes to save.");
      return;
    }
    bulkAllocate.mutate(assignments, {
      onSuccess: () => {
        showSuccess(`Allocations Saved — ${assignments.length} account${assignments.length === 1 ? "" : "s"} updated`);
        setPending({});
        setSelected(new Set());
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to save allocations."),
    });
  };

  const totalAccounts = rows.length;
  const changedCount = rows.filter(isChanged).length;
  const filtersActive = !!(geo || region || critical);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">DE Account Allocation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Assign accounts to Delivery Excellence auditors, or reassign / clear an existing allocation
          </p>
        </div>
      </header>

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold">Couldn&apos;t load the allocation list.</p>
          <p className="mt-1 text-red-600">
            {error instanceof ApiError ? String(error.detail ?? error.message) : "Something went wrong."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label={
                view === "unallocated"
                  ? "Awaiting Allocation"
                  : view === "allocated"
                    ? "Allocated Accounts"
                    : "Accounts"
              }
              value={totalAccounts}
              accent={view === "unallocated" && totalAccounts > 0 ? "red" : undefined}
            />
            <StatCard label="Auditor Changes (unsaved)" value={changedCount} />
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-600">
                  Show
                  <NativeSelect
                    aria-label="Show accounts"
                    value={view}
                    onChange={(e) => {
                      setView(e.target.value as DeAccountAllocationFilter);
                      setSkip(0);
                      setPending({});
                      setSelected(new Set());
                    }}
                    className="h-9 w-44 text-sm"
                  >
                    {VIEW_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <div className="relative min-w-[200px] flex-1">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    aria-label="Search accounts"
                    placeholder="Search accounts…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSkip(0);
                    }}
                    className="h-9 pl-8"
                  />
                </div>
                <div className="w-40 shrink-0">
                  <NativeSelect aria-label="Geo" value={geo} onChange={(e) => {
                      setGeo(e.target.value);
                      setSkip(0);
                    }} className="h-9 text-sm">
                    <option value="">Geo [All]</option>
                    {geos.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="w-44 shrink-0">
                  <NativeSelect aria-label="Region" value={region} onChange={(e) => {
                      setRegion(e.target.value);
                      setSkip(0);
                    }} className="h-9 text-sm">
                    <option value="">Region [All]</option>
                    {regions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="w-44 shrink-0">
                  <NativeSelect aria-label="Critical" value={critical} onChange={(e) => {
                      setCritical(e.target.value);
                      setSkip(0);
                    }} className="h-9 text-sm">
                    <option value="">Critical [All]</option>
                    <option value="Yes">Critical: Yes</option>
                    <option value="No">Critical: No</option>
                  </NativeSelect>
                </div>
                {filtersActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setGeo("");
                      setRegion("");
                      setCritical("");
                      setSkip(0);
                    }}
                    className="text-sm font-semibold text-[#1a6fc4] hover:underline"
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">
                {rows.length > 0
                  ? "No accounts match the current filters."
                  : view === "unallocated"
                    ? "No accounts awaiting allocation — every active account already has a DE auditor."
                    : view === "allocated"
                      ? "No accounts have a DE auditor allocated yet."
                      : "No active accounts yet."}
              </p>
            ) : (
              <div>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#8EBBE0] bg-[#D6E9F8] text-xs font-bold tracking-wide text-[#205889] uppercase">
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select all"
                          className="size-4 rounded border-slate-300"
                          checked={selected.size > 0 && selected.size === filteredRows.length}
                          onChange={toggleAll}
                          disabled={!canWrite}
                        />
                      </th>
                      <th className="px-3 py-3">Account</th>
                      <th className="px-3 py-3">Geo</th>
                      <th className="px-3 py-3">Region</th>
                      <th className="px-3 py-3">Critical</th>
                      <th className="px-3 py-3">Account Head</th>
                      <th className="px-3 py-3 text-right">Projects</th>
                      <th className="px-3 py-3 w-[22%]">DE Auditor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const chosen = auditorFor(row);
                      const rowChanged = isChanged(row);
                      return (
                        <tr
                          key={row.account_id}
                          className="border-b border-[#E4E9EE] bg-white last:border-b-0 even:bg-[#F8FAFB] hover:bg-[#EDF3F7]"
                        >
                          <td className="px-4 py-2.5">
                            <input
                              type="checkbox"
                              aria-label={`Select ${row.account_name}`}
                              className="size-4 rounded border-slate-300"
                              checked={selected.has(row.account_id)}
                              onChange={() => toggleRow(row.account_id)}
                              disabled={!canWrite}
                            />
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{row.account_name}</td>
                          <td className="px-3 py-2.5 text-slate-600">{row.geo_name ?? "—"}</td>
                          <td className="px-3 py-2.5 text-slate-600">{row.region_name ?? "—"}</td>
                          <td className="px-3 py-2.5 text-slate-600">{row.critical_flag}</td>
                          <td className="px-3 py-2.5 text-slate-600">{row.account_head_name ?? "—"}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-600">{row.project_count}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-col gap-1">
                              <ResourcePicker
                                value={chosen}
                                onChange={(id) => setPending((prev) => ({ ...prev, [row.account_id]: id }))}
                                roleCode="DELIVERY_EXCELLENCE"
                                placeholder="Select Auditor"
                                disabled={!canWrite}
                                initialLabel={
                                  chosen && chosen === row.delivery_excellence_id
                                    ? (row.delivery_excellence_name ?? undefined)
                                    : undefined
                                }
                                className={cn("h-9 text-sm", rowChanged && "border-[#1a6fc4]")}
                              />
                              {row.delivery_excellence_id ? (
                                <span className="text-xs text-slate-400">
                                  {rowChanged
                                    ? chosen
                                      ? `Currently ${row.delivery_excellence_name ?? "allocated"} — will be reassigned on save`
                                      : `Currently ${row.delivery_excellence_name ?? "allocated"} — will be cleared on save`
                                    : `Allocated${row.de_allocated_at ? ` ${formatDate(row.de_allocated_at)}` : ""}`}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {filteredRows.length > PAGE_SIZE ? (
              <PaginationBar skip={pageSkip} limit={PAGE_SIZE} total={filteredRows.length} onPageChange={setSkip} />
            ) : null}
          </section>

          {canWrite ? (
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <Button variant="ghost" onClick={() => router.push("/dashboard/delivery-excellence")}>
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={bulkAllocate.isPending}
                className="gap-2 bg-[#1a4a7a] px-6 font-semibold text-white hover:bg-[#15406b]"
              >
                {bulkAllocate.isPending ? <ButtonSpinner /> : null}
                Save Allocations
              </Button>
            </div>
          ) : (
            <p className="border-t border-slate-200 pt-4 text-sm text-slate-400">
              You have read-only access to account allocation.
            </p>
          )}
        </>
      )}

      {canWrite && selected.size > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-full border border-slate-200 bg-white px-6 py-3 shadow-lg">
          <span className="text-sm font-semibold text-slate-900">
            {selected.size} Account{selected.size === 1 ? "" : "s"} Selected
          </span>
          <span className="h-6 w-px bg-slate-200" />
          <span className="text-sm text-slate-500">Assign To</span>
          <div className="w-52">
            <ResourcePicker
              value={bulkDe}
              onChange={setBulkDe}
              roleCode="DELIVERY_EXCELLENCE"
              placeholder="Select Auditor"
              className="h-9 text-sm"
            />
          </div>
          <Button
            size="sm"
            onClick={applyBulk}
            disabled={!bulkDe}
            className="bg-[#1a6fc4] text-white hover:bg-[#15406b]"
          >
            Apply
          </Button>
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => setSelected(new Set())}
            className="text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}
