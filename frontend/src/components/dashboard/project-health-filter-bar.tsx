"use client";

import { type ReactNode } from "react";

import { NativeSelect } from "@/components/ui/native-select";
import { useAccounts, useGeos, useProjectTypes, useRegions, useReportingPeriods } from "@/lib/api/reference-data";
import type { ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";

// Ownership model values — mirrors backend schemas.enums.ProjectOwned and the
// Project Charter's "Project Owned" dropdown.
const PROJECT_OWNED_OPTIONS = ["Fully Owned", "Co-Owned", "Customer Driven"] as const;

// Project Health dashboard (design-reference/Project-Health.html) filter bar
// — Geo/Account/Project Type/Period, plus opt-in Region and Ownership
// (showRegion / showOwnership) used by the Project List screen. No Project
// selector: there's no
// existing portfolio-scale project picker in this codebase to build one
// from, and a flat <select> enumerating every org-wide project wouldn't
// scale or fit this page's org-wide (not project-scoped) purpose.
//
// `children` lets a drill-down add its list-specific filters (e.g. the
// Findings screen's Classification / Due Status) into this one bar rather
// than stacking a second filter row. Such a page passes `extraFiltersActive`
// so Reset stays visible while they're set, and `onReset` so Reset clears
// them too.
export function ProjectHealthFilterBar({
  filters,
  onChange,
  showPeriod = true,
  showRegion = false,
  showOwnership = false,
  children,
  extraFiltersActive = false,
  onReset,
}: {
  filters: ProjectHealthDashboardFilters;
  onChange: (next: ProjectHealthDashboardFilters) => void;
  showPeriod?: boolean;
  showRegion?: boolean;
  showOwnership?: boolean;
  children?: ReactNode;
  extraFiltersActive?: boolean;
  onReset?: () => void;
}) {
  const { data: geos = [] } = useGeos();
  const { data: regions = [] } = useRegions();
  const { data: accounts = [] } = useAccounts();
  const { data: projectTypes = [] } = useProjectTypes();
  const { data: periods = [] } = useReportingPeriods();

  // Cascade the Region list off the selected Geo when one is chosen.
  const regionOptions = filters.geoId ? regions.filter((region) => region.geo_id === filters.geoId) : regions;

  // Account list cascades off the selected Geo (and Region, when shown).
  const accountOptions = accounts.filter(
    (account) =>
      (!filters.geoId || account.geo_id === filters.geoId) &&
      (!showRegion || !filters.regionId || account.region_id === filters.regionId),
  );

  const hasFilters = Boolean(
    filters.geoId ||
      (showRegion && filters.regionId) ||
      filters.accountId ||
      filters.projectTypeId ||
      (showOwnership && filters.projectOwned) ||
      (showPeriod && filters.periodId)
  );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">Filters</span>

      <div className="w-40">
        <NativeSelect
          aria-label="Geo"
          className="h-9 bg-white text-sm"
          value={filters.geoId ?? ""}
          onChange={(e) => onChange({ ...filters, geoId: e.target.value || undefined, regionId: undefined, accountId: undefined })}
        >
          <option value="">Geo [All]</option>
          {geos.map((geo) => (
            <option key={geo.id} value={geo.id}>
              {geo.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {showRegion ? (
        <div className="w-44">
          <NativeSelect
            aria-label="Region"
            className="h-9 bg-white text-sm"
            value={filters.regionId ?? ""}
            onChange={(e) => onChange({ ...filters, regionId: e.target.value || undefined, accountId: undefined })}
          >
            <option value="">Region [All]</option>
            {regionOptions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      <div className="w-48">
        <NativeSelect
          aria-label="Account"
          className="h-9 bg-white text-sm"
          value={filters.accountId ?? ""}
          onChange={(e) => onChange({ ...filters, accountId: e.target.value || undefined })}
        >
          <option value="">Account [All]</option>
          {accountOptions.map((account) => (
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

      {showOwnership ? (
        <div className="w-44">
          <NativeSelect
            aria-label="Ownership"
            className="h-9 bg-white text-sm"
            value={filters.projectOwned ?? ""}
            onChange={(e) => onChange({ ...filters, projectOwned: e.target.value || undefined })}
          >
            <option value="">Ownership [All]</option>
            {PROJECT_OWNED_OPTIONS.map((owned) => (
              <option key={owned} value={owned}>
                {owned}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

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

      {children}

      {hasFilters || extraFiltersActive ? (
        <button
          type="button"
          onClick={() => {
            onChange({});
            onReset?.();
          }}
          className="ml-auto text-sm font-semibold text-[#1a6fc4] hover:underline"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
