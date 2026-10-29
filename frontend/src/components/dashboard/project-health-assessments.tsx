"use client";

import { useProjectHealthFilters, useScreenFilters } from "@/stores/project-health-filters";
import * as React from "react";

import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { cn } from "@/lib/utils";
import { useProjectHealthDashboardSummary } from "@/lib/api/project-health-dashboard";
import {
  formatGeoRegion,
  useProjectHealthAssessments,
  type AssessmentRow,
} from "@/lib/api/project-health-lists";
import { accountBubbleClass, bubbleClass } from "./high-risks";
import { ProjectHealthFilterBar } from "./project-health-filter-bar";
import { LayoutGrid, ShieldCheck } from "lucide-react";

import { AccentSection, BackToProjectHealth, Card, ErrorBlock, HealthBadge, RagFilterTiles } from "./project-health-kpi";

const PAGE_SIZE = 10;

type Row = AssessmentRow & { id: string };

function StatusPill({ value }: { value: string }) {
  const compliant = value === "Compliant";
  const notAssessed = value === "Not Assessed";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1",
        notAssessed
          ? "bg-slate-50 text-slate-500 ring-slate-200"
          : compliant
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
            : "bg-red-50 text-red-700 ring-red-200"
      )}
    >
      {value}
    </span>
  );
}

export function ProjectHealthAssessments() {
  const [filters, setFilters] = useProjectHealthFilters();
  const [skip, setSkip] = React.useState(0);
  // The KPI bucket picked on the tiles below — narrows the list to that bucket.
  const { overall: status, setOverall: setStatus, reset: resetStatus } = useScreenFilters("assessments");

  const { data: summary } = useProjectHealthDashboardSummary(filters);
  const { data, isLoading, isError, error, refetch } = useProjectHealthAssessments({ ...filters, status: status || undefined, skip, limit: PAGE_SIZE });

  // Same entity cell as View Project RAG / Account RAG: the project, with its
  // Geo / Region / Account as chips that narrow the page filters.
  const chip = (className: string, title: string, label: string, apply: () => void) => (
    <button
      type="button"
      className={className}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        apply();
        setSkip(0);
      }}
    >
      {label}
    </button>
  );

  const columns: RegisterColumn<Row>[] = [
    {
      key: "project_label",
      label: "Project",
      render: (row) => (
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-slate-900">{row.project_label}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {row.geo_name
              ? chip(bubbleClass, "Filter by this geo", row.geo_name, () =>
                  setFilters((f) => ({ ...f, geoId: row.geo_id ?? undefined, regionId: undefined, accountId: undefined })),
                )
              : null}
            {row.region_name
              ? chip(bubbleClass, "Filter by this region", row.region_name, () =>
                  setFilters((f) => ({
                    ...f,
                    geoId: row.geo_id ?? f.geoId,
                    regionId: row.region_id ?? undefined,
                    accountId: undefined,
                  })),
                )
              : null}
            {row.account_name
              ? chip(accountBubbleClass, "Filter by this account", row.account_name, () =>
                  setFilters((f) => ({ ...f, accountId: row.account_id ?? undefined })),
                )
              : null}
          </div>
        </div>
      ),
      // The export keeps Geo - Region and Account in the project cell's text.
      excelValue: (row) =>
        [row.project_label, formatGeoRegion(row.geo_name, row.region_name), row.account_name]
          .filter((v) => v && v !== "—")
          .join(" | "),
    },
    { key: "pm_health", label: "Project Manager Health", render: (row) => <HealthBadge value={row.pm_health} /> },
    { key: "de_health", label: "DE Health", render: (row) => <HealthBadge value={row.de_health} /> },
    { key: "pci_score", label: "DE Score", render: (row) => (row.pci_score ? `${row.pci_score}%` : "—") },
    { key: "assessment_period", label: "Assessment Period" },
    { key: "assessed_by_name", label: "Assessed By" },
    { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} /> },
  ];

  const rows: Row[] = (data?.items ?? []).map((row) => ({ ...row, id: row.project_id }));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="flex flex-col gap-2">
        <BackToProjectHealth current="Assessments" />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Assessments</h1>
        <p className="text-slate-500">The latest submitted Delivery Excellence assessment of each project for the selected week.</p>
      </header>

      <ProjectHealthFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setSkip(0);
        }}
        extraFiltersActive={!!status}
        onReset={resetStatus}
      />

      <Card
        title="Project Health Assessed by DE"
        icon={ShieldCheck}
        iconClassName="text-[#1a6fc4]"
        period={`Selected Period: ${summary?.period_label ?? "current week"}`}
      >
        <RagFilterTiles
          buckets={["Green", "Amber", "Potential Red", "Red", "Not Assessed"]}
          counts={{
            Green: summary?.de_assessments.green_count,
            Amber: summary?.de_assessments.amber_count,
            "Potential Red": summary?.de_assessments.potential_red_count,
            Red: summary?.de_assessments.red_count,
            "Not Assessed": summary?.de_assessments.not_assessed_count,
          }}
          selected={status}
          onSelect={(bucket) => {
            setStatus(bucket);
            setSkip(0);
          }}
        />
      </Card>

      {isError ? (
        <ErrorBlock title="Couldn't load assessments." error={error} onRetry={() => refetch()} />
      ) : (
        <AccentSection
          icon={LayoutGrid}
          heading={summary?.period_label ? `Projects — ${summary.period_label}` : "Projects"}
        >
          <RegisterTable flush items={rows} columns={columns} emptyLabel={isLoading ? "Loading…" : "No assessments found."} />
          <PaginationBar skip={skip} limit={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setSkip} />
        </AccentSection>
      )}
    </div>
  );
}
