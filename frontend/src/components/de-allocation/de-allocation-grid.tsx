"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { useRoles, useUsers } from "@/lib/api/reference-data";
import {
  useBulkAllocateDe,
  useDeAllocationList,
  type DeAllocationAssignment,
  type DeAllocationRow,
} from "@/lib/api/de-allocation";
import { effectiveProjectStatus } from "@/lib/api/projects";
import { canAllocateDe } from "@/lib/api/de-approval-permissions";
import { usePageBanner } from "@/stores/page-banner";
import { useSession } from "@/stores/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/forms/status-badge";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { StatCard } from "@/components/de-assessment-workspace/shared";

// DE Project Allocation (design-reference/de-approval) — a DE (or Admin) assigns
// projects to a Delivery Excellence assessor. Allocation is not period-scoped:
// the whole pool is shown regardless of reporting period.
//
// The list filter is purely on allocation state, not project status: a row is
// "Allocated" once it has a DE assessor and "Unallocated" otherwise, whether the
// project is Pending Approval or Approved. (Draft projects never reach the grid.)
const STATUS_FILTER_OPTIONS = [
  { value: "Unallocated", label: "Unallocated" },
  { value: "Allocated", label: "Allocated" },
] as const;

export function DeAllocationGrid() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const canWrite = canAllocateDe(user?.role.code);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const { data: rows = [], isLoading, isError, error, refetch } = useDeAllocationList();

  const { data: roles = [] } = useRoles();
  const { data: users = [] } = useUsers();
  const deRoleId = roles.find((r) => r.code === "DELIVERY_EXCELLENCE")?.id;
  const assessors = React.useMemo(
    () => users.filter((u) => u.is_active && u.role_id === deRoleId).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users, deRoleId],
  );

  const [search, setSearch] = React.useState("");
  const [accountFilter, setAccountFilter] = React.useState("All");
  // Default view is the work-to-do list: projects still awaiting a DE assessor.
  const [statusFilter, setStatusFilter] = React.useState("Unallocated");

  // Dirty per-row assessor overrides (projectId -> deUserId) plus multi-select.
  const [pending, setPending] = React.useState<Record<string, string>>({});
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkDe, setBulkDe] = React.useState("");

  const bulkAllocate = useBulkAllocateDe();

  const accountNames = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.account_name).filter((n): n is string => !!n))).sort(),
    [rows],
  );

  const filteredRows = rows.filter((row) => {
    if (search && !`${row.project_code} ${row.project_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (accountFilter !== "All" && row.account_name !== accountFilter) return false;

    const isAllocated = !!row.delivery_excellence_id;
    if (statusFilter === "Allocated") {
      if (!isAllocated) return false;
    } else {
      // "Unallocated" (default) — any project with no assessor yet.
      if (isAllocated) return false;
    }
    return true;
  });

  const assessorFor = (row: DeAllocationRow) => pending[row.project_id] ?? row.delivery_excellence_id ?? "";

  const toggleRow = (projectId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === filteredRows.length ? new Set() : new Set(filteredRows.map((r) => r.project_id)),
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
    setBulkDe("");
  };

  const save = () => {
    const assignments: DeAllocationAssignment[] = Object.entries(pending)
      .filter(([projectId, deId]) => deId && deId !== (rows.find((r) => r.project_id === projectId)?.delivery_excellence_id ?? ""))
      .map(([project_id, delivery_excellence_id]) => ({ project_id, delivery_excellence_id }));
    if (assignments.length === 0) {
      showError("No allocation changes to save.");
      return;
    }
    bulkAllocate.mutate(assignments, {
      onSuccess: () => {
        showSuccess(`Allocations Saved — ${assignments.length} project${assignments.length === 1 ? "" : "s"} updated`);
        setPending({});
        setSelected(new Set());
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to save allocations."),
    });
  };

  // KPIs cover the whole allocation grid regardless of project status.
  const totalProjects = rows.length;
  const allocatedCount = rows.filter((r) => assessorFor(r)).length;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">DE Project Allocation</h1>
          <p className="mt-1 text-sm text-slate-500">Assign projects to Delivery Excellence assessors</p>
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
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total Projects" value={totalProjects} />
            <StatCard label="Allocated" value={allocatedCount} />
            <StatCard label="Unallocated" value={totalProjects - allocatedCount} accent="red" />
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    aria-label="Search projects"
                    placeholder="Search projects…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-8"
                  />
                </div>
                <div className="w-44 shrink-0">
                  <NativeSelect
                    aria-label="Account filter"
                    className="h-9 text-sm"
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                  >
                    <option value="All">Account [All]</option>
                    {accountNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="w-52 shrink-0">
                  <NativeSelect
                    aria-label="Allocation status filter"
                    className="h-9 text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    {STATUS_FILTER_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">
                {rows.length === 0
                  ? "No projects awaiting allocation."
                  : statusFilter === "Unallocated"
                    ? "No unallocated projects — every project awaiting approval has a DE assessor."
                    : "No projects match the current filters."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
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
                      <th className="px-3 py-3">Project</th>
                      <th className="px-3 py-3">Account</th>
                      <th className="px-3 py-3">Project Manager</th>
                      <th className="px-3 py-3">Allocation</th>
                      <th className="px-3 py-3 text-right">Completion</th>
                      <th className="px-3 py-3 min-w-[220px]">DE Assessor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const chosen = assessorFor(row);
                      return (
                        <tr
                          key={row.project_id}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                        >
                          <td className="px-4 py-2.5">
                            <input
                              type="checkbox"
                              aria-label={`Select ${row.project_code}`}
                              className="size-4 rounded border-slate-300"
                              checked={selected.has(row.project_id)}
                              onChange={() => toggleRow(row.project_id)}
                              disabled={!canWrite}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-slate-900">{row.project_name}</div>
                            <div className="font-mono text-xs text-slate-400">{row.project_code}</div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{row.account_name ?? "—"}</td>
                          <td className="px-3 py-2.5 text-slate-600">{row.project_manager_name ?? "—"}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                                  row.delivery_excellence_id
                                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                    : "bg-red-50 text-red-700 ring-red-200",
                                )}
                              >
                                {row.delivery_excellence_id ? "Allocated" : "Unallocated"}
                              </span>
                              {row.project_status === "Approved" ? (
                                <StatusBadge value={effectiveProjectStatus(row)} />
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-600">{row.completion_pct}%</td>
                          <td className="px-3 py-2.5">
                            <NativeSelect
                              aria-label={`DE Assessor for ${row.project_code}`}
                              className={cn(
                                "h-9 text-sm",
                                chosen ? "text-slate-900" : "text-slate-400",
                                pending[row.project_id] && "border-[#1a6fc4]",
                              )}
                              value={chosen}
                              disabled={!canWrite}
                              onChange={(e) =>
                                setPending((prev) => ({ ...prev, [row.project_id]: e.target.value }))
                              }
                            >
                              <option value="">Select Assessor</option>
                              {assessors.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.full_name}
                                </option>
                              ))}
                            </NativeSelect>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
              You have read-only access to project allocation.
            </p>
          )}
        </>
      )}

      {canWrite && selected.size > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-full border border-slate-200 bg-white px-6 py-3 shadow-lg">
          <span className="text-sm font-semibold text-slate-900">
            {selected.size} Project{selected.size === 1 ? "" : "s"} Selected
          </span>
          <span className="h-6 w-px bg-slate-200" />
          <span className="text-sm text-slate-500">Assign To</span>
          <NativeSelect
            aria-label="Bulk assessor"
            className="h-9 w-44 text-sm"
            value={bulkDe}
            onChange={(e) => setBulkDe(e.target.value)}
          >
            <option value="">Select Assessor</option>
            {assessors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </NativeSelect>
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
