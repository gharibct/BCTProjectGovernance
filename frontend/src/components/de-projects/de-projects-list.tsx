"use client";

import * as React from "react";
import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { effectiveProjectStatus, useDeProjects } from "@/lib/api/projects";
import { useAccounts, useGeos, useProjectTypes, useRegions, useUsers } from "@/lib/api/reference-data";
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

// Ownership model values — mirrors backend schemas.enums.ProjectOwned and the
// Project Charter's "Project Owned" dropdown.
const PROJECT_OWNED_OPTIONS = ["Fully Owned", "Co-Owned", "Customer Driven"] as const;

// Read-only browser of every non-Draft project, for the Delivery Excellence
// role. Draft projects are excluded server-side (useDeProjects). Names are
// joined client-side from the reference-data hooks.
export function DeProjectsList() {
  const { data: projects = [], isLoading, isError, error, refetch } = useDeProjects();
  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();
  const { data: regions = [] } = useRegions();
  const { data: projectTypes = [] } = useProjectTypes();
  const { data: users = [] } = useUsers();

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "—";
  const geoName = (id: string | null) => geos.find((g) => g.id === id)?.name ?? null;
  const regionName = (id: string | null) => regions.find((r) => r.id === id)?.name ?? null;
  const userName = (id: string | null) => users.find((u) => u.id === id)?.full_name ?? "—";

  const [search, setSearch] = React.useState("");
  const [geoId, setGeoId] = React.useState("");
  const [regionId, setRegionId] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [projectTypeId, setProjectTypeId] = React.useState("");
  const [ownership, setOwnership] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("All");

  // Cascade the Region list off the selected Geo, matching ProjectHealthFilterBar.
  const regionOptions = geoId ? regions.filter((r) => r.geo_id === geoId) : regions;

  const rows = projects.filter((p) => {
    const q = search.trim().toLowerCase();
    if (q && !`${p.project_name} ${p.project_code}`.toLowerCase().includes(q)) return false;
    if (geoId && p.geo_id !== geoId) return false;
    if (regionId && p.region_id !== regionId) return false;
    if (accountId && p.account_id !== accountId) return false;
    if (projectTypeId && p.project_type_id !== projectTypeId) return false;
    if (ownership && p.project_owned !== ownership) return false;
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
                value={geoId}
                onChange={(e) => {
                  setGeoId(e.target.value);
                  setRegionId("");
                }}
              >
                <option value="">Geo [All]</option>
                {geos.map((geo) => (
                  <option key={geo.id} value={geo.id}>
                    {geo.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="w-44 shrink-0">
              <NativeSelect
                aria-label="Region filter"
                className="h-9 text-sm"
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
              >
                <option value="">Region [All]</option>
                {regionOptions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="w-48 shrink-0">
              <NativeSelect
                aria-label="Account filter"
                className="h-9 text-sm"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">Account [All]</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="w-44 shrink-0">
              <NativeSelect
                aria-label="Project Type filter"
                className="h-9 text-sm"
                value={projectTypeId}
                onChange={(e) => setProjectTypeId(e.target.value)}
              >
                <option value="">Project Type [All]</option>
                {projectTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="w-44 shrink-0">
              <NativeSelect
                aria-label="Ownership filter"
                className="h-9 text-sm"
                value={ownership}
                onChange={(e) => setOwnership(e.target.value)}
              >
                <option value="">Ownership [All]</option>
                {PROJECT_OWNED_OPTIONS.map((owned) => (
                  <option key={owned} value={owned}>
                    {owned}
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
