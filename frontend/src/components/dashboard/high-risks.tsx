"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useReturnToRow } from "@/lib/return-to-row";
import { FileText, HeartPulse, LayoutGrid } from "lucide-react";

import { GovernanceMatrix } from "@/components/dashboard/governance-matrix";
import { ProjectHealthFilterBar } from "@/components/dashboard/project-health-filter-bar";
import { BackToProjectHealth, Card, ErrorBlock, RagFilterTiles } from "@/components/dashboard/project-health-kpi";
import { NativeSelect } from "@/components/ui/native-select";
import {
  DELIVERY_HEALTH_STATUSES,
  HIGH_RISK_STATUSES,
  useHighRisks,
  type HighRiskAccountRow,
  type HighRiskStatus,
} from "@/lib/api/high-risks";
import { useScreenFilters, useProjectHealthFilters } from "@/stores/project-health-filters";
import { useProjectHealthPeriods } from "@/lib/api/project-health-dashboard";
import { sectionAccentColor } from "@/lib/section-accent-colors";

// Executive Risk Dashboard: only the worst status.
const EXECUTIVE_STATUSES: HighRiskStatus[] = ["Red"];

// Counts per bucket come from the response's `kpis`.
const KPI_KEYS: Record<HighRiskStatus, "red" | "amber" | "green" | "not_submitted"> = {
  Red: "red",
  Amber: "amber",
  Green: "green",
  "Not Submitted": "not_submitted",
};

// Links/bubbles inside the clickable first column handle their own click.
const stop = (e: React.MouseEvent) => e.stopPropagation();

export const bubbleClass =
  "inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#1a6fc4] ring-1 ring-blue-200 transition-colors hover:bg-blue-100";

// Account chip (Project Health Dashboard) — a different colour from the Geo / Region chips.
export const accountBubbleClass =
  "inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200 transition-colors hover:bg-violet-100";

// Total FTE chip next to the DM name — informational (not a filter), so its own
// colour and no hover state.
const fteBubbleClass =
  "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200";

const formatFte = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

// High Risks (CXO / Geo Head): every account that is not Green for the chosen
// weekly period, plus the accounts that have not filed — same grid as the Geo
// report's Summary, in the Project Health page chrome (filter bar, KPI cells).
// Filters live in the shared project-health-filters store; `?back=` only tells
// the account report's breadcrumb where to return.
// `govOne` = launched from the GovOne Dashboard cards (/project-health/rag and
// /project-health/account-rag): same screen, but with the GovOne breadcrumb and
// report back-links that return to the GovOne-hosted route.
export function HighRisks({
  variant = "all",
  govOne = false,
}: {
  variant?: "all" | "executive" | "delivery-health" | "project-health";
  govOne?: boolean;
}) {
  const executive = variant === "executive";
  const deliveryHealth = variant === "delivery-health";
  // Project Health Dashboard: the Delivery Health grid at project level.
  const projectHealth = variant === "project-health";
  const basePath = executive
    ? "/executive-risk"
    : deliveryHealth
      ? govOne
        ? "/project-health/account-rag"
        : "/delivery-health"
      : projectHealth
        ? govOne
          ? "/project-health/rag"
          : "/projects-health"
        : "/high-risks";
  const statuses = executive
    ? EXECUTIVE_STATUSES
    : deliveryHealth || projectHealth
      ? DELIVERY_HEALTH_STATUSES
      : HIGH_RISK_STATUSES;
  const title = executive
    ? "Executive Risk Dashboard"
    : deliveryHealth
      ? "Delivery Health Dashboard"
      : projectHealth
        ? "Project Health Dashboard"
        : "High Risk Dashboard";
  const router = useRouter();
  const { data: periods = [] } = useProjectHealthPeriods();

  const [filters, setFilters] = useProjectHealthFilters();
  // Overall RAG, plus the Delivery Manager (Delivery Health) / Project Manager
  // (Project Health) filter — kept per screen in the same store.
  const { overall: overallRaw, managerId, dmId, setOverall: setOverallRaw, setManagerId, setDmId, reset: resetExtras } =
    useScreenFilters(variant);
  const overall: HighRiskStatus | "" = statuses.find((s) => s === overallRaw) ?? "";
  const setOverall = (value: HighRiskStatus | "") => setOverallRaw(value);

  const periodId = filters.periodId ?? periods[0]?.id ?? "";
  const period = periods.find((p) => p.id === periodId);

  const { data, isLoading, isError, error, refetch } = useHighRisks(
    {
      periodId,
      geoId: filters.geoId,
      regionId: filters.regionId,
      accountId: filters.accountId,
      overall,
      // Delivery Health: the one manager filter is the DM. Project Health has both
      // a Delivery Manager and a Project Manager filter.
      deliveryManagerId: deliveryHealth ? managerId || undefined : projectHealth ? dmId || undefined : undefined,
      projectManagerId: projectHealth ? managerId || undefined : undefined,
    },
    deliveryHealth ? "delivery-health" : projectHealth ? "project-health-grid" : "high-risks"
  );

  // Only the breadcrumb target for the report page — the filters themselves
  // live in the shared store, so they are still set when the user comes back.
  const backPath = basePath;

  // Back from a report: scroll to and highlight the row that was opened.
  const { markRow, onClickCapture } = useReturnToRow(variant, !isLoading && !!data);

  const accountHref = (id: string) =>
    `/account-review/${id}?period=${periodId}&back=${encodeURIComponent(backPath)}`;
  const projectHref = (id: string) =>
    `/project-review/${id}?period=${periodId}&back=${encodeURIComponent(backPath)}`;
  const rowHref = projectHealth ? projectHref : accountHref;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {govOne ? <BackToProjectHealth current={projectHealth ? "Project RAG" : "Account RAG"} /> : null}
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1.5 text-slate-500">
            {executive
              ? "Accounts rated Red for the selected week."
              : projectHealth
                ? "Delivery health of every active project for the selected week, including Green projects and projects that have not submitted their report."
                : deliveryHealth
                ? "Delivery health of every account for the selected week, including Green accounts and accounts that have not submitted their report."
                : "Accounts that are not Green for the selected week, plus accounts that have not submitted their report."}
          </p>
        </div>
        {period ? <p className="text-sm text-slate-400">Period: {period.label}</p> : null}
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={setFilters}
        extraFiltersActive={!!overall || !!managerId || !!dmId}
        onReset={resetExtras}
      >
        <div className="w-44">
          <NativeSelect
            aria-label="Overall RAG"
            className="h-9 bg-white text-sm"
            value={overall}
            onChange={(e) => setOverall(e.target.value as HighRiskStatus | "")}
          >
            <option value="">Overall RAG [All]</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </div>
        {projectHealth ? (
          <div className="w-48">
            <NativeSelect
              aria-label="Delivery Manager"
              className="h-9 bg-white text-sm"
              value={dmId}
              onChange={(e) => setDmId(e.target.value)}
            >
              <option value="">Delivery Manager [All]</option>
              {(data?.delivery_managers ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        {deliveryHealth || projectHealth ? (
          <div className="w-48">
            <NativeSelect
              aria-label={projectHealth ? "Project Manager" : "Delivery Manager"}
              className="h-9 bg-white text-sm"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">{projectHealth ? "Project Manager [All]" : "Delivery Manager [All]"}</option>
              {(projectHealth ? (data?.project_managers ?? []) : (data?.delivery_managers ?? [])).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </ProjectHealthFilterBar>

      <Card title={projectHealth ? "Project Health" : deliveryHealth ? "Account Health" : "Accounts at Risk"} icon={HeartPulse} iconClassName="text-red-600" period={period ? `Selected Period: ${period.label}` : undefined}>
        <RagFilterTiles
          buckets={statuses}
          counts={Object.fromEntries(statuses.map((st) => [st, data ? data.kpis[KPI_KEYS[st]] : "—"]))}
          selected={overall}
          onSelect={(bucket) => setOverall(bucket as HighRiskStatus | "")}
        />
      </Card>

      {isError ? (
        <ErrorBlock title={`Couldn't load ${title}.`} error={error} onRetry={() => refetch()} />
      ) : (
        <div onClickCapture={onClickCapture}>
        <GovernanceMatrix<HighRiskAccountRow>
          heading={
            projectHealth
              ? period
                ? `Projects — ${period.label}`
                : "Projects"
              : period
                ? `Accounts at risk — ${period.label}`
                : "Accounts at risk"
          }
          icon={LayoutGrid}
          accentColor={sectionAccentColor(0)}
          entityColumnLabel={projectHealth ? "Projects" : "Accounts"}
          rows={executive ? data?.items.filter((r) => statuses.includes(r.risk_status)) : data?.items}
          entityHref={rowHref}
          // Not Submitted rows have no report to open, so nothing launches for them.
          onEntityClick={(row) => {
            markRow(row.entity_id);
            router.push(rowHref(row.entity_id));
          }}
          entityClickable={(row) => row.risk_status !== "Not Submitted"}
          actionColumn={{
            label: "Report",
            render: (row) =>
              row.risk_status === "Not Submitted" ? (
                <span
                  aria-disabled="true"
                  title="No report submitted for this period"
                  className="inline-flex cursor-not-allowed items-center gap-1 rounded-xl bg-slate-200 px-2.5 py-1 text-xs leading-tight font-semibold text-slate-400"
                >
                  <FileText className="size-3 shrink-0" />
                  <span>View<br />Report</span>
                </span>
              ) : (
              <Link
                href={rowHref(row.entity_id)}
                title={projectHealth ? "Open this project's report" : "Open this account's report"}
                className="inline-flex items-center gap-1 rounded-xl bg-[#1a6fc4] px-2.5 py-1 text-xs leading-tight font-semibold text-white transition-colors hover:bg-[#15406b]"
              >
                <FileText className="size-3 shrink-0" />
                <span>View<br />Report</span>
              </Link>
            ),
          }}
          renderEntity={(row) => (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {row.risk_status === "Not Submitted" ? (
                  <span>{row.entity_label}</span>
                ) : (
                  <Link href={rowHref(row.entity_id)} onClick={stop} className="hover:underline">
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
                {projectHealth && row.account_name ? (
                  <button
                    type="button"
                    className={accountBubbleClass}
                    title="Filter by this account"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilters((f) => ({ ...f, accountId: row.account_id ?? undefined }));
                    }}
                  >
                    {row.account_name}
                  </button>
                ) : null}
                <span className="text-xs font-normal text-slate-500">DM: {row.delivery_manager_name ?? "—"}</span>
                {!projectHealth && row.total_fte != null ? (
                  <span className={fteBubbleClass} title="Total FTE = Onsite FTE + Offshore FTE">
                    Total FTE: {formatFte(row.total_fte)}
                  </span>
                ) : null}
                {projectHealth ? (
                  <span className="text-xs font-normal text-slate-500">PM: {row.project_manager_name ?? "—"}</span>
                ) : null}
              </div>
            </div>
          )}
          overallLabel="Delivery RAG"
          circleCategories
          riskColumns={!projectHealth}
          emptyLabel={isLoading || !periodId ? "Loading…" : executive ? "No Red accounts for these filters." : "No high-risk accounts for these filters."}
        />
        </div>
      )}
    </div>
  );
}
