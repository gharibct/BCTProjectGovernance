"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, HeartPulse, LayoutGrid } from "lucide-react";

import { GovernanceMatrix } from "@/components/dashboard/governance-matrix";
import { ProjectHealthFilterBar } from "@/components/dashboard/project-health-filter-bar";
import { Card, ErrorBlock, RagCountCell } from "@/components/dashboard/project-health-kpi";
import { NativeSelect } from "@/components/ui/native-select";
import {
  HIGH_RISK_STATUSES,
  useHighRisks,
  type HighRiskAccountRow,
  type HighRiskStatus,
} from "@/lib/api/high-risks";
import { useProjectHealthPeriods, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import { sectionAccentColor } from "@/lib/section-accent-colors";
import { cn } from "@/lib/utils";

const KPI_TILES: {
  status: HighRiskStatus;
  label: string;
  key: "red" | "potential_red" | "amber" | "not_submitted";
  className: string;
  valueClassName: string;
}[] = [
  { status: "Red", label: "Red", key: "red", className: "border-red-100 bg-red-50 text-red-700", valueClassName: "text-red-600" },
  {
    status: "Potential Red",
    label: "Pot. Red",
    key: "potential_red",
    className: "border-orange-100 bg-orange-50 text-orange-700",
    valueClassName: "text-orange-600",
  },
  {
    status: "Amber",
    label: "Amber",
    key: "amber",
    className: "border-amber-100 bg-amber-50 text-amber-700",
    valueClassName: "text-amber-500",
  },
  {
    status: "Not Submitted",
    label: "Not Submitted",
    key: "not_submitted",
    className: "border-slate-200 bg-slate-50 text-slate-500",
    valueClassName: "text-slate-900",
  },
];

// Links/bubbles inside the clickable first column handle their own click.
const stop = (e: React.MouseEvent) => e.stopPropagation();

const bubbleClass =
  "inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#1a6fc4] ring-1 ring-blue-200 transition-colors hover:bg-blue-100";

// High Risks (CXO / Geo Head): every account that is not Green for the chosen
// weekly period, plus the accounts that have not filed — same grid as the Geo
// report's Summary, in the Project Health page chrome (filter bar, KPI cells).
// Filters ride along in `?back=` so the account report's breadcrumb returns
// here with the same view.
export function HighRisks() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: periods = [] } = useProjectHealthPeriods();

  const [filters, setFilters] = React.useState<ProjectHealthDashboardFilters>({
    periodId: searchParams.get("period") ?? undefined,
    geoId: searchParams.get("geo") ?? undefined,
    regionId: searchParams.get("region") ?? undefined,
    accountId: searchParams.get("account") ?? undefined,
  });
  const [overall, setOverall] = React.useState<HighRiskStatus | "">(
    HIGH_RISK_STATUSES.find((s) => s === searchParams.get("overall")) ?? ""
  );

  const periodId = filters.periodId ?? periods[0]?.id ?? "";
  const period = periods.find((p) => p.id === periodId);

  const { data, isLoading, isError, error, refetch } = useHighRisks({
    periodId,
    geoId: filters.geoId,
    regionId: filters.regionId,
    accountId: filters.accountId,
    overall,
  });

  const backPath = React.useMemo(() => {
    const qs = new URLSearchParams();
    if (periodId) qs.set("period", periodId);
    if (filters.geoId) qs.set("geo", filters.geoId);
    if (filters.regionId) qs.set("region", filters.regionId);
    if (filters.accountId) qs.set("account", filters.accountId);
    if (overall) qs.set("overall", overall);
    return `/high-risks?${qs.toString()}`;
  }, [periodId, filters, overall]);

  const accountHref = (id: string) =>
    `/account-review/${id}?period=${periodId}&back=${encodeURIComponent(backPath)}`;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">High Risks</h1>
          <p className="mt-1.5 text-slate-500">
            Accounts that are not Green for the selected week, plus accounts that have not submitted their report.
          </p>
        </div>
        {period ? <p className="text-sm text-slate-400">Period: {period.label}</p> : null}
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={setFilters}
        extraFiltersActive={!!overall}
        onReset={() => setOverall("")}
      >
        <div className="w-44">
          <NativeSelect
            aria-label="Overall RAG"
            className="h-9 bg-white text-sm"
            value={overall}
            onChange={(e) => setOverall(e.target.value as HighRiskStatus | "")}
          >
            <option value="">Overall RAG [All]</option>
            {HIGH_RISK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </div>
      </ProjectHealthFilterBar>

      <Card title="Accounts at Risk" icon={HeartPulse} iconClassName="text-red-600" period={period ? `Selected Period: ${period.label}` : undefined}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KPI_TILES.map((tile) => {
            const selected = overall === tile.status;
            return (
              <button
                key={tile.status}
                type="button"
                aria-pressed={selected}
                title={selected ? "Show all" : `Show only ${tile.label}`}
                onClick={() => setOverall(selected ? "" : tile.status)}
                className={cn(
                  "cursor-pointer rounded-md text-left no-underline transition-shadow hover:shadow-md",
                  selected && "ring-2 ring-[#1a6fc4]"
                )}
              >
                <RagCountCell
                  label={tile.label}
                  value={data ? data.kpis[tile.key] : "—"}
                  className={cn("py-2", tile.className)}
                  valueClassName={cn("text-2xl underline underline-offset-4", tile.valueClassName)}
                />
              </button>
            );
          })}
        </div>
      </Card>

      {isError ? (
        <ErrorBlock title="Couldn't load High Risks." error={error} onRetry={() => refetch()} />
      ) : (
        <GovernanceMatrix<HighRiskAccountRow>
          heading={period ? `Accounts at risk — ${period.label}` : "Accounts at risk"}
          icon={LayoutGrid}
          accentColor={sectionAccentColor(0)}
          entityColumnLabel="Accounts"
          rows={data?.items}
          entityHref={accountHref}
          // Not Submitted accounts have no report to open, so nothing launches for them.
          onEntityClick={(row) => router.push(accountHref(row.entity_id))}
          entityClickable={(row) => row.risk_status !== "Not Submitted"}
          actionColumn={{
            label: "Report",
            render: (row) =>
              row.risk_status === "Not Submitted" ? (
                <span
                  aria-disabled="true"
                  title="No report submitted for this period"
                  className="inline-flex cursor-not-allowed items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-slate-400"
                >
                  <FileText className="size-3" />
                  View Report
                </span>
              ) : (
              <Link
                href={accountHref(row.entity_id)}
                title="Open this account's report"
                className="inline-flex items-center gap-1 rounded-full bg-[#1a6fc4] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#15406b]"
              >
                <FileText className="size-3" />
                View Report
              </Link>
            ),
          }}
          renderEntity={(row) => (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {row.risk_status === "Not Submitted" ? (
                  <span>{row.entity_label}</span>
                ) : (
                  <Link href={accountHref(row.entity_id)} onClick={stop} className="hover:underline">
                    {row.entity_label}
                  </Link>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {row.geo_name ? (
                  <button
                    type="button"
                    className={bubbleClass}
                    title="Filter by this geo"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilters((f) => ({ ...f, geoId: row.geo_id ?? undefined, regionId: undefined, accountId: undefined }));
                    }}
                  >
                    {row.geo_name}
                  </button>
                ) : null}
                {row.region_name ? (
                  <button
                    type="button"
                    className={bubbleClass}
                    title="Filter by this region"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilters((f) => ({
                        ...f,
                        geoId: row.geo_id ?? f.geoId,
                        regionId: row.region_id ?? undefined,
                        accountId: undefined,
                      }));
                    }}
                  >
                    {row.region_name}
                  </button>
                ) : null}
                <span className="text-xs font-normal text-slate-500">DM: {row.delivery_manager_name ?? "—"}</span>
              </div>
            </div>
          )}
          emptyLabel={isLoading || !periodId ? "Loading…" : "No high-risk accounts for these filters."}
        />
      )}
    </div>
  );
}
