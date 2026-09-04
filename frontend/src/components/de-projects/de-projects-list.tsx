"use client";

import * as React from "react";
import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { effectiveProjectStatus, useDeProjects } from "@/lib/api/projects";
import { useAccounts, useGeos, useRegions, useUsers } from "@/lib/api/reference-data";
import { formatGeoRegion } from "@/lib/api/project-health-lists";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/forms/status-badge";
import { HealthDot } from "@/components/de-assessment-workspace/shared";

// The effective status the "Status" column shows — a mix of approval-workflow
// (project_status) and lifecycle (lifecycle_status) values.
const STATUS_OPTIONS: string[] = [
  "Pending Approval",
  "Approved",
  "Under Amendment",
  "Ongoing",
  "Hold",
  "Closed",
  "Open Only for Billing",
];

// Read-only browser of every non-Draft project, for the Delivery Excellence
// role. Draft projects are excluded server-side (useDeProjects). Names are
// joined client-side from the reference-data hooks.
export function DeProjectsList() {
  const { data: projects = [], isLoading, isError, error, refetch } = useDeProjects();
  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();
  const { data: regions = [] } = useRegions();
  const { data: users = [] } = useUsers();

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "—";
  const geoName = (id: string | null) => geos.find((g) => g.id === id)?.name ?? null;
  const regionName = (id: string | null) => regions.find((r) => r.id === id)?.name ?? null;
  const userName = (id: string | null) => users.find((u) => u.id === id)?.full_name ?? "—";

  const [search, setSearch] = React.useState("");
  const [geoFilter, setGeoFilter] = React.useState("All");
  const [statusFilter, setStatusFilter] = React.useState("All");

  const geoNames = React.useMemo(
    () =>
      Array.from(new Set(projects.map((p) => geoName(p.geo_id)).filter((n): n is string => !!n))).sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, geos]
  );

  const rows = projects.filter((p) => {
    const q = search.trim().toLowerCase();
    if (q && !`${p.project_name} ${p.project_code}`.toLowerCase().includes(q)) return false;
    if (geoFilter !== "All" && geoName(p.geo_id) !== geoFilter) return false;
    if (statusFilter !== "All" && effectiveProjectStatus(p) !== statusFilter) return false;
    return true;
  });

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Projects</h1>
        <p className="mt-1 text-sm text-slate-500">Read-only view of all active projects</p>
      </header>

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold">Couldn&apos;t load projects.</p>
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
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <Input
              aria-label="Search Project"
              placeholder="Search project name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 min-w-[240px] flex-1"
            />
            <div className="w-40 shrink-0">
              <NativeSelect
                aria-label="Geo filter"
                className="h-9 text-sm"
                value={geoFilter}
                onChange={(e) => setGeoFilter(e.target.value)}
              >
                <option value="All">Geo [All]</option>
                {geoNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="w-48 shrink-0">
              <NativeSelect
                aria-label="Status filter"
                className="h-9 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">Status [All]</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {rows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">
                {isLoading
                  ? "Loading…"
                  : projects.length === 0
                    ? "No projects found."
                    : "No projects match the current filters."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                      <th className="px-5 py-3">Project</th>
                      <th className="px-3 py-3">Account</th>
                      <th className="px-3 py-3">Geo - Region</th>
                      <th className="px-3 py-3">Project Manager</th>
                      <th className="px-3 py-3">Delivery Excellence</th>
                      <th className="px-3 py-3 text-center">Health</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-2.5">
                          <div className="font-semibold text-slate-900">{p.project_name}</div>
                          <div className="font-mono text-xs text-slate-400">{p.project_code}</div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{accountName(p.account_id)}</td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {formatGeoRegion(geoName(p.geo_id), regionName(p.region_id))}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{userName(p.project_manager_id)}</td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {userName(p.delivery_excellence_id)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <HealthDot health={p.overall_project_health} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge value={effectiveProjectStatus(p)} />
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <Link
                            href={`/de-projects/${p.id}`}
                            className="rounded-md bg-[#1a6fc4] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a6fc4]/90"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
