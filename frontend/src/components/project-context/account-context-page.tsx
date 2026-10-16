"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { useAccounts, useGeos, useRegions, useReportingPeriods, type Account } from "@/lib/api/reference-data";
import { useAccountReportStatusByPeriod } from "@/lib/api/regional-status";
import { submissionStatusLabel } from "@/lib/api/project-status";
import { useAccountHead } from "@/lib/api/users";
import { completedWeeklyPeriods } from "@/lib/period-utils";
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

const STATUS_BADGE: Record<string, string> = {
  Approved: "bg-emerald-100 text-emerald-800",
  Submitted: "bg-blue-100 text-blue-800",
  Rejected: "bg-red-100 text-red-800",
  "Not Submitted": "bg-amber-100 text-amber-800",
};

const REPORT_STATUSES = ["Not Submitted", "Submitted", "Approved", "Rejected"];

function reportStatusLabel(status: string | undefined): string {
  return status ? submissionStatusLabel(status as Parameters<typeof submissionStatusLabel>[0]) : "Not Submitted";
}

// The account's Delivery Manager (primary Account Head), resolved per visible row.
function DeliveryManagerCell({ accountId }: { accountId: string }) {
  const { data: head, isLoading } = useAccountHead(accountId);
  return <>{isLoading ? "…" : head?.full_name || "—"}</>;
}

function ReportStatusBadge({ status, loading }: { status: string | undefined; loading: boolean }) {
  if (loading) return <span className="text-slate-400">…</span>;
  const label = reportStatusLabel(status);
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[label] ?? "bg-slate-100 text-slate-700"}`}>
      {label}
    </span>
  );
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
  const [reportStatus, setReportStatus] = React.useState(ALL);
  const [skip, setSkip] = React.useState(0);

  // Update Account Status Report / Account Delivery Status (weekly): pick one of the last 12
  // completed periods and show each account's report state for it.
  const showPeriod = targetId === "account-reporting" || targetId === "account-review";
  const { data: allPeriods = [] } = useReportingPeriods();
  const weekOptions = React.useMemo(() => completedWeeklyPeriods(allPeriods, 12), [allPeriods]);
  const [pickedPeriodId, setPickedPeriodId] = React.useState("");
  const periodId = showPeriod ? pickedPeriodId || weekOptions[0]?.id || "" : "";
  const statusByAccount = useAccountReportStatusByPeriod(showPeriod ? periodId || null : null).data;

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
        // Report Status filter: only once the period's statuses have loaded.
        if (showPeriod && reportStatus && statusByAccount && reportStatusLabel(statusByAccount.get(a.id)) !== reportStatus)
          return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [reportingAccounts, search, geoId, regionId, showPeriod, reportStatus, statusByAccount]);

  const page = filtered.slice(skip, skip + PAGE_SIZE);
  const filtersActive = !!(search || geoId || regionId || reportStatus);
  const reset = () => {
    setSearch("");
    setReportStatus(ALL);
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
          {showPeriod ? (
            <div className="w-56">
              <NativeSelect
                aria-label="Weekly period"
                className="h-10 text-sm"
                value={periodId}
                onChange={(e) => setPickedPeriodId(e.target.value)}
              >
                {weekOptions.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.id === weekOptions[0]?.id ? `${w.label} (Current)` : w.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          {showPeriod ? (
            <div className="w-44">
              <NativeSelect
                aria-label="Report Status"
                className="h-10 text-sm"
                value={reportStatus}
                onChange={(e) => {
                  setReportStatus(e.target.value);
                  setSkip(0);
                }}
              >
                <option value={ALL}>All Report Statuses</option>
                {REPORT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
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
                    {showPeriod ? <th className="px-3 py-3">Delivery Manager</th> : null}
                    <th className="px-3 py-3">Geo</th>
                    {showPeriod ? <th className="px-3 py-3">Report Status</th> : null}
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
                        {showPeriod ? (
                          <td className="px-3 py-2.5 text-[#172033]">
                            <DeliveryManagerCell accountId={a.id} />
                          </td>
                        ) : null}
                        <td className="px-3 py-2.5 text-[#172033]">{geoLabel(a)}</td>
                        {showPeriod ? (
                          <td className="px-3 py-2.5">
                            <ReportStatusBadge status={statusByAccount ? statusByAccount.get(a.id) : undefined} loading={!statusByAccount} />
                          </td>
                        ) : null}
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
