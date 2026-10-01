"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { useAccounts, useGeos, useRegions, type Account } from "@/lib/api/reference-data";
import { usePatchScope } from "@/hooks/use-patch-scope";
import { ACCOUNT_TARGETS, isAccountTargetId } from "@/lib/account-context-targets";
import { useAccountContext } from "@/stores/account-context";
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

export function AccountContextPage() {
  const params = useParams<{ target: string }>();
  const router = useRouter();
  const targetId = params.target;

  if (!isAccountTargetId(targetId)) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Select Account</h1>
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
  targetId: keyof typeof ACCOUNT_TARGETS;
  onNavigate: (href: string) => void;
}) {
  const target = ACCOUNT_TARGETS[targetId];
  const { isLoading, isError } = useAccounts();
  const { reportingAccounts } = usePatchScope();
  const { data: geos = [] } = useGeos();
  const { data: regions = [] } = useRegions();
  const { lastAccessed, touch } = useAccountContext();

  const geoName = React.useMemo(() => new Map(geos.map((g) => [g.id, g.name])), [geos]);
  const select = (account: Account) => {
    touch(account.id);
    onNavigate(target.hrefFor(account.id));
  };

  // --- All Accounts: search + Geo filter -------------------------------------
  const [search, setSearch] = React.useState("");
  const [geoId, setGeoId] = React.useState(ALL);
  const [regionId, setRegionId] = React.useState(ALL);
  const [skip, setSkip] = React.useState(0);

  const geoOptions = React.useMemo(() => {
    const ids = new Set(reportingAccounts.map((a) => a.geo_id).filter((id): id is string => !!id));
    return geos.filter((g) => ids.has(g.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [reportingAccounts, geos]);

  const regionOptions = React.useMemo(() => {
    const ids = new Set(
      reportingAccounts
        .filter((a) => !geoId || a.geo_id === geoId)
        .map((a) => a.region_id)
        .filter((id): id is string => !!id)
    );
    return regions.filter((r) => ids.has(r.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [reportingAccounts, regions, geoId]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return reportingAccounts
      .filter((a) => {
        if (geoId && a.geo_id !== geoId) return false;
        if (regionId && a.region_id !== regionId) return false;
        if (q && !a.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const la = lastAccessed[a.id] ?? "";
        const lb = lastAccessed[b.id] ?? "";
        if (la !== lb) return lb.localeCompare(la);
        return a.name.localeCompare(b.name);
      });
  }, [reportingAccounts, search, geoId, regionId, lastAccessed]);

  const page = filtered.slice(skip, skip + PAGE_SIZE);
  const filtersActive = !!(search || geoId || regionId);
  const reset = () => {
    setSearch("");
    setGeoId(ALL);
    setRegionId(ALL);
    setSkip(0);
  };

  const geoLabel = (a: Account) => (a.geo_id && geoName.get(a.geo_id)) || "—";

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Select Account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose an account to continue. Your selection will open{" "}
          <span className="font-semibold text-slate-700">{target.label}</span>.
        </p>
      </header>

      {/* All Accounts */}
      <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-500">
            {filtered.length === 0
              ? "No accounts"
              : `Showing ${skip + 1} - ${Math.min(skip + PAGE_SIZE, filtered.length)} of ${filtered.length} accounts`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 py-4">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Search accounts"
              placeholder="Search account by name…"
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
          <p className="text-sm text-red-600">Couldn&apos;t load accounts.</p>
        ) : isLoading ? (
          <p className="text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-400">
            {filtersActive ? "No accounts match these filters." : target.emptyLabel}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-[#D0D9E2]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#8EBBE0] bg-[#D6E9F8] text-xs font-bold tracking-wide text-[#205889] uppercase">
                    <th className="px-4 py-3">Actions</th>
                    <th className="px-3 py-3">Account</th>
                    <th className="px-3 py-3">Geo</th>
                    <th className="px-3 py-3">Last Accessed</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((a) => {
                    return (
                      <tr
                        key={a.id}
                        onClick={() => select(a)}
                        className="cursor-pointer border-b border-[#E4E9EE] bg-white last:border-b-0 even:bg-[#F8FAFB] hover:bg-[#EDF3F7]"
                      >
                        <td className="px-4 py-2.5">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              select(a);
                            }}
                            className="bg-[#1a4a7a] font-semibold text-white hover:bg-[#15406b]"
                          >
                            Select
                          </Button>
                        </td>
                        <td className="px-3 py-2.5 text-[#172033]">{a.name}</td>
                        <td className="px-3 py-2.5 text-[#172033]">{geoLabel(a)}</td>
                        <td className="px-3 py-2.5 text-[#172033]">{formatAccessed(lastAccessed[a.id])}</td>
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
