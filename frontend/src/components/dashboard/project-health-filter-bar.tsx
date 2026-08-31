"use client";

import { NativeSelect } from "@/components/ui/native-select";
import { useAccounts, useGeos, useProjectTypes, useReportingPeriods } from "@/lib/api/reference-data";
import type { ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";

// Project Health dashboard (design-reference/Project-Health.html) filter bar
// — Geo/Account/Project Type/Period only, no Project selector: there's no
// existing portfolio-scale project picker in this codebase to build one
// from, and a flat <select> enumerating every org-wide project wouldn't
// scale or fit this page's org-wide (not project-scoped) purpose.
export function ProjectHealthFilterBar({
  filters,
  onChange,
  showPeriod = true,
}: {
  filters: ProjectHealthDashboardFilters;
  onChange: (next: ProjectHealthDashboardFilters) => void;
  showPeriod?: boolean;
}) {
  const { data: geos = [] } = useGeos();
  const { data: accounts = [] } = useAccounts();
  const { data: projectTypes = [] } = useProjectTypes();
  const { data: periods = [] } = useReportingPeriods();

  const hasFilters = Boolean(
    filters.geoId || filters.accountId || filters.projectTypeId || (showPeriod && filters.periodId)
  );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">Filters</span>

      <div className="w-40">
        <NativeSelect
          aria-label="Geo"
          className="h-9 bg-white text-sm"
          value={filters.geoId ?? ""}
          onChange={(e) => onChange({ ...filters, geoId: e.target.value || undefined })}
        >
          <option value="">Geo [All]</option>
          {geos.map((geo) => (
            <option key={geo.id} value={geo.id}>
              {geo.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="w-48">
        <NativeSelect
          aria-label="Account"
          className="h-9 bg-white text-sm"
          value={filters.accountId ?? ""}
          onChange={(e) => onChange({ ...filters, accountId: e.target.value || undefined })}
        >
          <option value="">Account [All]</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="w-44">
        <NativeSelect
          aria-label="Project Type"
          className="h-9 bg-white text-sm"
          value={filters.projectTypeId ?? ""}
          onChange={(e) => onChange({ ...filters, projectTypeId: e.target.value || undefined })}
        >
          <option value="">Project Type [All]</option>
          {projectTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {showPeriod ? (
        <div className="w-40">
          <NativeSelect
            aria-label="Period"
            className="h-9 bg-white text-sm"
            value={filters.periodId ?? ""}
            onChange={(e) => onChange({ ...filters, periodId: e.target.value || undefined })}
          >
            <option value="">Period [Current]</option>
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {hasFilters ? (
        <button
          type="button"
          onClick={() => onChange({})}
          className="ml-auto text-sm font-semibold text-[#1a6fc4] hover:underline"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
