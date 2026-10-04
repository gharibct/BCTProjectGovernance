"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { useProjects, type Project } from "@/lib/api/projects";
import { useAccounts, useGeos, useRegions } from "@/lib/api/reference-data";
import { usePatchScope } from "@/hooks/use-patch-scope";
import {
  PROJECT_TARGETS,
  isProjectTargetId,
} from "@/lib/project-context-targets";
import { projectActivitiesRestricted, useAllActivityRestrictions } from "@/lib/api/activity-restrictions";
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
  const { isLoading, isError, data: allProjects = [] } = useProjects();
  const { patchProjects } = usePatchScope();
  const { data: geos = [] } = useGeos();
  const { data: regions = [] } = useRegions();
  const { data: accounts = [] } = useAccounts();
  const { lastAccessed, touch } = useProjectContext();

  const geoName = React.useMemo(() => new Map(geos.map((g) => [g.id, g.name])), [geos]);
  const accountName = React.useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const { data: restrictions } = useAllActivityRestrictions();

  const eligible = React.useMemo(
    () =>
      (target.scope === "all" ? allProjects : patchProjects).filter(
        (p) =>
          target.eligible(p) &&
          !(target.hiddenWhenRestricted && projectActivitiesRestricted(restrictions, p.id, target.hiddenWhenRestricted)),
      ),
    [allProjects, patchProjects, target, restrictions]
  );

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

      {/* All Projects */}
      <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-500">
            {filtered.length === 0
              ? "No projects"
              : `Showing ${skip + 1} - ${Math.min(skip + PAGE_SIZE, filtered.length)} of ${filtered.length} projects`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 py-4">
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
          <Button
            type="button"
            variant="secondary"
            onClick={reset}
            disabled={!filtersActive}
            className="h-10 px-4 font-semibold"
          >
            Reset
          </Button>
        </div>

        {isError ? (
          <p className="text-sm text-red-600">Couldn&apos;t load projects.</p>
        ) : isLoading ? (
          <p className="text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-400">
            {filtersActive ? "No projects match these filters." : target.emptyLabel}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-[#D0D9E2]">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#8EBBE0] bg-[#D6E9F8] text-xs font-bold tracking-wide text-[#205889] uppercase">
                    <th className="px-4 py-3">Actions</th>
                    <th className="px-3 py-3">Project Code</th>
                    <th className="px-3 py-3">Project Name</th>
                    <th className="px-3 py-3">Account</th>
                    <th className="px-3 py-3">Geo</th>
                    <th className="px-3 py-3">Last Accessed</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((p) => {
                    return (
                      <tr
                        key={p.id}
                        onClick={() => select(p)}
                        className="cursor-pointer border-b border-[#E4E9EE] bg-white last:border-b-0 even:bg-[#F8FAFB] hover:bg-[#EDF3F7]"
                      >
                        <td className="px-4 py-2.5">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              select(p);
                            }}
                            className="bg-[#1a4a7a] font-semibold text-white hover:bg-[#15406b]"
                          >
                            Select
                          </Button>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[#1a6fc4]">{p.project_code}</td>
                        <td className="px-3 py-2.5 text-[#172033]">{p.project_name}</td>
                        <td className="px-3 py-2.5 text-[#172033]">
                          {(p.account_id && accountName.get(p.account_id)) || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[#172033]">
                          {(p.geo_id && geoName.get(p.geo_id)) || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[#172033]">{formatAccessed(lastAccessed[p.id])}</td>
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
