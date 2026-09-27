"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Building2, Clock, FolderOpen, Globe, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { useProjects, type Project } from "@/lib/api/projects";
import { useAccounts, useGeos, useRegions } from "@/lib/api/reference-data";
import { usePatchScope } from "@/hooks/use-patch-scope";
import {
  PROJECT_TARGETS,
  isProjectTargetId,
} from "@/lib/project-context-targets";
import { useProjectContext } from "@/stores/project-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PaginationBar } from "@/components/forms/pagination-bar";

const PAGE_SIZE = 10;
const ALL = "";

function formatAccessed(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ProjectContextPage() {
  const params = useParams<{ target: string }>();
  const router = useRouter();
  const targetId = params.target;

  if (!isProjectTargetId(targetId)) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Select Project</h1>
        <p className="mt-2 text-sm text-slate-500">Unknown screen.</p>
      </div>
    );
  }
  return <ContextBody targetId={targetId} onNavigate={(href) => router.push(href)} />;
}

function ContextBody({
  targetId,
  onNavigate,
}: {
  targetId: keyof typeof PROJECT_TARGETS;
  onNavigate: (href: string) => void;
}) {
  const target = PROJECT_TARGETS[targetId];
  const { isLoading, isError } = useProjects();
  const { patchProjects } = usePatchScope();
  const { data: geos = [] } = useGeos();
  const { data: regions = [] } = useRegions();
  const { data: accounts = [] } = useAccounts();
  const { current, recent, lastAccessed, touch, clearRecent } = useProjectContext();

  const geoName = React.useMemo(() => new Map(geos.map((g) => [g.id, g.name])), [geos]);
  const accountName = React.useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const byId = React.useMemo(() => new Map(patchProjects.map((p) => [p.id, p])), [patchProjects]);
  const eligible = React.useMemo(
    () => patchProjects.filter(target.eligible),
    [patchProjects, target]
  );

  const currentProject = current ? byId.get(current) : undefined;
  const currentEligible = !!currentProject && target.eligible(currentProject);
  const recentProjects = recent
    .map((id) => byId.get(id))
    .filter((p): p is Project => !!p && target.eligible(p));

  const select = (project: Project) => {
    touch(project.id);
    onNavigate(target.hrefFor(project.id));
  };

  // --- All Projects: search + Geo / Account filters --------------------------
  const [search, setSearch] = React.useState("");
  const [geoId, setGeoId] = React.useState(ALL);
  const [regionId, setRegionId] = React.useState(ALL);
  const [accountId, setAccountId] = React.useState(ALL);
  const [skip, setSkip] = React.useState(0);

  const geoOptions = React.useMemo(() => {
    const ids = new Set(eligible.map((p) => p.geo_id).filter((id): id is string => !!id));
    return geos.filter((g) => ids.has(g.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [eligible, geos]);
  const regionOptions = React.useMemo(() => {
    const ids = new Set(
      eligible
        .filter((p) => !geoId || p.geo_id === geoId)
        .map((p) => p.region_id)
        .filter((id): id is string => !!id)
    );
    return regions.filter((r) => ids.has(r.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [eligible, regions, geoId]);
  const accountOptions = React.useMemo(() => {
    const ids = new Set(
      eligible
        .filter((p) => !geoId || p.geo_id === geoId)
        .filter((p) => !regionId || p.region_id === regionId)
        .map((p) => p.account_id)
        .filter((id): id is string => !!id)
    );
    return accounts.filter((a) => ids.has(a.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [eligible, accounts, geoId, regionId]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return eligible
      .filter((p) => {
        if (geoId && p.geo_id !== geoId) return false;
        if (regionId && p.region_id !== regionId) return false;
        if (accountId && p.account_id !== accountId) return false;
        if (q && !`${p.project_code} ${p.project_name}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const la = lastAccessed[a.id] ?? "";
        const lb = lastAccessed[b.id] ?? "";
        if (la !== lb) return lb.localeCompare(la);
        return a.project_code.localeCompare(b.project_code);
      });
  }, [eligible, search, geoId, regionId, accountId, lastAccessed]);

  const page = filtered.slice(skip, skip + PAGE_SIZE);
  const filtersActive = !!(search || geoId || regionId || accountId);
  const reset = () => {
    setSearch("");
    setGeoId(ALL);
    setRegionId(ALL);
    setAccountId(ALL);
    setSkip(0);
  };

  const meta = (p: Project) =>
    [p.account_id ? accountName.get(p.account_id) : null, p.geo_id ? geoName.get(p.geo_id) : null]
      .filter(Boolean)
      .join("  |  ") || "—";

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Select Project</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose a project to continue. Your selection will open{" "}
            <span className="font-semibold text-slate-700">{target.label}</span>.
          </p>
        </div>
      </header>

      {/* Current Project */}
      <section className="rounded-xl border border-[#1a6fc4]/30 bg-blue-50/60 px-6 py-5">
        <h2 className="text-lg font-bold text-[#1a6fc4]">Currently Selected Project</h2>
        {currentProject ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-x-10 gap-y-3">
              <div className="flex items-center gap-4">
                <span className="flex size-14 items-center justify-center rounded-xl border border-blue-200 bg-blue-100 text-[#1a6fc4]">
                  <FolderOpen className="size-7" />
                </span>
                <div>
                  <p className="font-mono text-xs text-slate-500">{currentProject.project_code}</p>
                  <p className="text-xl font-bold text-slate-900">{currentProject.project_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="size-6 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500">Account</p>
                  <p className="font-semibold text-slate-900">
                    {(currentProject.account_id && accountName.get(currentProject.account_id)) || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Globe className="size-6 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500">Geo</p>
                  <p className="font-semibold text-slate-900">
                    {(currentProject.geo_id && geoName.get(currentProject.geo_id)) || "—"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button
                size="lg"
                disabled={!currentEligible}
                onClick={() => select(currentProject)}
                className="gap-2 bg-[#1a6fc4] px-6 font-semibold text-white hover:bg-[#155a9e]"
              >
                <ArrowRight className="size-4" />
                Continue to {target.label}
              </Button>
              {!currentEligible ? (
                <p className="text-xs text-slate-500">
                  This project isn&apos;t available for {target.label} — pick another below.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No project selected yet — pick one from the list below.
          </p>
        )}
      </section>

      {/* Recent Projects */}
      <section className="rounded-xl border border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#1a6fc4]">
            <Clock className="size-5 text-[#1a6fc4]" />
            Recent Projects
            <span className="text-sm font-normal text-slate-500">(Last 10)</span>
          </h2>
          {recentProjects.length > 0 ? (
            <button
              type="button"
              onClick={clearRecent}
              className="text-sm font-semibold text-[#1a6fc4] hover:underline"
            >
              Clear Recent
            </button>
          ) : null}
        </div>
        {recentProjects.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No recently accessed projects.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {recentProjects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => select(p)}
                title={p.project_name}
                className={cn(
                  "min-w-0 rounded-lg border px-4 py-3 text-left transition-colors hover:border-[#1a6fc4] hover:bg-blue-50/50",
                  p.id === current ? "border-[#1a6fc4] bg-blue-50" : "border-slate-200 bg-white"
                )}
              >
                <p className="font-mono text-xs text-slate-500">{p.project_code}</p>
                <p className="mt-0.5 truncate font-bold text-slate-900">{p.project_name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{meta(p)}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* All Projects */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 pt-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#1a6fc4]">
            <FolderOpen className="size-5" />
            All Projects
          </h2>
          <p className="text-sm text-slate-500">
            {filtered.length === 0
              ? "No projects"
              : `Showing ${skip + 1} - ${Math.min(skip + PAGE_SIZE, filtered.length)} of ${filtered.length} projects`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Search projects"
              placeholder="Search project by code or name…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSkip(0);
              }}
              className="h-10 pl-9"
            />
          </div>
          <div className="w-44">
            <NativeSelect
              aria-label="Geo"
              className="h-10 text-sm"
              value={geoId}
              onChange={(e) => {
                setGeoId(e.target.value);
                setRegionId(ALL);
                setAccountId(ALL);
                setSkip(0);
              }}
            >
              <option value={ALL}>All Geos</option>
              {geoOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="w-44">
            <NativeSelect
              aria-label="Region"
              className="h-10 text-sm"
              value={regionId}
              onChange={(e) => {
                setRegionId(e.target.value);
                setAccountId(ALL);
                setSkip(0);
              }}
            >
              <option value={ALL}>All Regions</option>
              {regionOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="w-52">
            <NativeSelect
              aria-label="Account"
              className="h-10 text-sm"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setSkip(0);
              }}
            >
              <option value={ALL}>All Accounts</option>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={!filtersActive}
            className="text-sm font-semibold text-[#1a6fc4] hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
          >
            Reset
          </button>
        </div>

        {isError ? (
          <p className="px-6 pb-6 text-sm text-red-600">Couldn&apos;t load projects.</p>
        ) : isLoading ? (
          <p className="px-6 pb-6 text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-slate-400">
            {filtersActive ? "No projects match these filters." : target.emptyLabel}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-y border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                    <th className="px-4 py-3">Actions</th>
                    <th className="w-10 px-2 py-3" />
                    <th className="px-3 py-3">Project Code</th>
                    <th className="px-3 py-3">Project Name</th>
                    <th className="px-3 py-3">Account</th>
                    <th className="px-3 py-3">Geo</th>
                    <th className="px-3 py-3">Last Accessed</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((p) => {
                    const isCurrent = p.id === current;
                    return (
                      <tr
                        key={p.id}
                        className={cn(
                          "border-b border-slate-100 last:border-b-0",
                          isCurrent ? "bg-blue-50" : "hover:bg-slate-50/70"
                        )}
                      >
                        <td className="px-4 py-2.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isCurrent}
                            onClick={() => select(p)}
                            className="font-semibold"
                          >
                            {isCurrent ? "Selected" : "Select"}
                          </Button>
                        </td>
                        <td className="px-2 py-2.5">
                          <span
                            aria-hidden
                            className={cn(
                              "flex size-4 items-center justify-center rounded-full border",
                              isCurrent ? "border-[#1a6fc4] bg-[#1a6fc4]" : "border-slate-300"
                            )}
                          >
                            {isCurrent ? <span className="size-1.5 rounded-full bg-white" /> : null}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[#1a6fc4]">{p.project_code}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900">{p.project_name}</td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {(p.account_id && accountName.get(p.account_id)) || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {(p.geo_id && geoName.get(p.geo_id)) || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{formatAccessed(lastAccessed[p.id])}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar
              skip={skip}
              limit={PAGE_SIZE}
              total={filtered.length}
              onPageChange={setSkip}
            />
          </>
        )}
      </section>
    </div>
  );
}
