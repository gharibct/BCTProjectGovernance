"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Building2, Clock, Globe, Search } from "lucide-react";

import { cn } from "@/lib/utils";
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
  const { current, recent, lastAccessed, touch, clearRecent } = useAccountContext();

  const geoName = React.useMemo(() => new Map(geos.map((g) => [g.id, g.name])), [geos]);
  const byId = React.useMemo(
    () => new Map(reportingAccounts.map((a) => [a.id, a])),
    [reportingAccounts]
  );

  const currentAccount = current ? byId.get(current) : undefined;
  const recentAccounts = recent.map((id) => byId.get(id)).filter((a): a is Account => !!a);

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

      {/* Current Account */}
      <section className="rounded-xl border border-[#1a6fc4]/30 bg-blue-50/60 px-6 py-5">
        <h2 className="text-lg font-bold text-[#1a6fc4]">Currently Selected Account</h2>
        {currentAccount ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-x-10 gap-y-3">
              <div className="flex items-center gap-4">
                <span className="flex size-14 items-center justify-center rounded-xl border border-blue-200 bg-blue-100 text-[#1a6fc4]">
                  <Building2 className="size-7" />
                </span>
                <p className="text-xl font-bold text-slate-900">{currentAccount.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <Globe className="size-6 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500">Geo</p>
                  <p className="font-semibold text-slate-900">{geoLabel(currentAccount)}</p>
                </div>
              </div>
            </div>
            <Button
              size="lg"
              onClick={() => select(currentAccount)}
              className="gap-2 bg-[#1a6fc4] px-6 font-semibold text-white hover:bg-[#155a9e]"
            >
              <ArrowRight className="size-4" />
              Continue to {target.label}
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No account selected yet — pick one from the list below.
          </p>
        )}
      </section>

      {/* Recent Accounts */}
      <section className="rounded-xl border border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#1a6fc4]">
            <Clock className="size-5 text-[#1a6fc4]" />
            Recent Accounts
            <span className="text-sm font-normal text-slate-500">(Last 10)</span>
          </h2>
          {recentAccounts.length > 0 ? (
            <button
              type="button"
              onClick={clearRecent}
              className="text-sm font-semibold text-[#1a6fc4] hover:underline"
            >
              Clear Recent
            </button>
          ) : null}
        </div>
        {recentAccounts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No recently accessed accounts.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {recentAccounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => select(a)}
                title={a.name}
                className={cn(
                  "min-w-0 rounded-lg border px-4 py-3 text-left transition-colors hover:border-[#1a6fc4] hover:bg-blue-50/50",
                  a.id === current ? "border-[#1a6fc4] bg-blue-50" : "border-slate-200 bg-white"
                )}
              >
                <p className="truncate font-bold text-slate-900">{a.name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{geoLabel(a)}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* All Accounts */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 pt-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#1a6fc4]">
            <Building2 className="size-5" />
            All Accounts
          </h2>
          <p className="text-sm text-slate-500">
            {filtered.length === 0
              ? "No accounts"
              : `Showing ${skip + 1} - ${Math.min(skip + PAGE_SIZE, filtered.length)} of ${filtered.length} accounts`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
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
          <p className="px-6 pb-6 text-sm text-red-600">Couldn&apos;t load accounts.</p>
        ) : isLoading ? (
          <p className="px-6 pb-6 text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-slate-400">
            {filtersActive ? "No accounts match these filters." : target.emptyLabel}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-y border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                    <th className="px-4 py-3">Actions</th>
                    <th className="w-10 px-2 py-3" />
                    <th className="px-3 py-3">Account</th>
                    <th className="px-3 py-3">Geo</th>
                    <th className="px-3 py-3">Last Accessed</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((a) => {
                    const isCurrent = a.id === current;
                    return (
                      <tr
                        key={a.id}
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
                            onClick={() => select(a)}
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
                        <td className="px-3 py-2.5 font-semibold text-slate-900">{a.name}</td>
                        <td className="px-3 py-2.5 text-slate-600">{geoLabel(a)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{formatAccessed(lastAccessed[a.id])}</td>
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
