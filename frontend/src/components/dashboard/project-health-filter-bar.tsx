"use client";

import { useEffect, type ReactNode } from "react";

import { NativeSelect } from "@/components/ui/native-select";
import { useAccounts, useGeos, useRegions } from "@/lib/api/reference-data";
import { useEffectiveRole, useSession } from "@/stores/session";
import { useProjectHealthPeriods, type ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";

// Ownership model values — mirrors backend schemas.enums.ProjectOwned and the
// Project Charter's "Project Owned" dropdown.
const PROJECT_OWNED_OPTIONS = ["Fully Owned", "Co-Owned", "Customer Driven"] as const;

// Project Health dashboard (design-reference/Project-Health.html) filter bar
// — Geo/Account/Period, plus opt-in Region and Ownership
// (showRegion / showOwnership) used by the Project List screen. No Project
// Type filter, and no Project
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
//
// A Geo Head is locked to the geo(s) they own: the Geo combo lists only those.
// With a single geo there's no "All" and it's preselected; with several, "All"
// (= all their geos, enforced server-side) is available and the default. The
// Account combo only offers accounts in the selected geo(s). An Account Manager likewise only sees their own
// accounts (and those accounts' geos) in the combos. The backend enforces the
// same scoping — Project Health is open to every role, results are role-scoped.
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
  const { data: periods = [] } = useProjectHealthPeriods();

  const effectiveRole = useEffectiveRole();
  const isGeoHead = effectiveRole === "GEO_HEAD";
  const isAccountManager = effectiveRole === "ACCOUNT_MANAGER";
  const ownedGeoIds = useSession((s) => s.user?.geo_ids ?? []);
  const ownedAccountIds = useSession((s) => s.user?.account_ids ?? []);
  const ownedAccountGeoIds = accounts
    .filter((account) => ownedAccountIds.includes(account.id))
    .map((account) => account.geo_id);
  const geoOptions = isGeoHead
    ? geos.filter((geo) => ownedGeoIds.includes(geo.id))
    : isAccountManager
      ? geos.filter((geo) => ownedAccountGeoIds.includes(geo.id))
      : geos;
  const geoHeadHasSingleGeo = isGeoHead && geoOptions.length === 1;
  const defaultGeoId = geoHeadHasSingleGeo ? geoOptions[0].id : undefined;

  // A single-geo Geo Head always has that geo selected — apply it on load and
  // after Reset (which clears the filters to {}).
  useEffect(() => {
    if (defaultGeoId && !filters.geoId) onChange({ ...filters, geoId: defaultGeoId });
  }, [defaultGeoId, filters, onChange]);

  // Cascade the Region list off the selected Geo when one is chosen.
  const regionOptions = filters.geoId ? regions.filter((region) => region.geo_id === filters.geoId) : regions;

  // Account list cascades off the selected Geo (and Region, when shown).
  const accountOptions = accounts.filter(
    (account) =>
      (!isAccountManager || ownedAccountIds.includes(account.id)) &&
      (!isGeoHead || (account.geo_id !== null && ownedGeoIds.includes(account.geo_id))) &&
      (!filters.geoId || account.geo_id === filters.geoId) &&
      (!showRegion || !filters.regionId || account.region_id === filters.regionId),
  );

  const hasFilters = Boolean(
    (filters.geoId && filters.geoId !== defaultGeoId) ||
      (showRegion && filters.regionId) ||
      filters.accountId ||
      (showOwnership && filters.projectOwned) ||
      (showPeriod && filters.periodId && filters.periodId !== periods[0]?.id)
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
          {geoHeadHasSingleGeo ? null : <option value="">Geo [All]</option>}
          {geoOptions.map((geo) => (
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
            value={filters.periodId ?? periods[0]?.id ?? ""}
            onChange={(e) => onChange({ ...filters, periodId: e.target.value || undefined })}
          >
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.is_current ? `${period.label} (Current)` : period.label}
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
