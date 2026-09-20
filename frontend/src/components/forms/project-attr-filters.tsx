"use client";

import * as React from "react";

import { NativeSelect } from "@/components/ui/native-select";

// Shared project-attribute filter row for the DE list/queue screens (DE
// Approval, DE Assessment, DE Allocation). Each of those screens loads a flat
// list of project rows and filters it client-side; this component derives its
// dropdown options from the distinct values present in those rows — the same
// pattern the screens already used for their single Geo filter — rather than
// the org-wide reference-data hooks.
//
// The Project Health → Project List screen keeps its own ProjectHealthFilterBar
// (id-based, reference-data driven) and does not use this.

export type ProjectAttrValue = {
  geo?: string;
  region?: string;
  account?: string;
  projectType?: string;
  ownership?: string;
};

// The row shape this component needs. Screen row types (DeApprovalQueueRow,
// DEAssessmentWorkQueueRow, DeAllocationRow) all satisfy this after the backend
// adds the missing name/ownership fields.
export type ProjectAttrRow = {
  geo_name: string | null;
  region_name: string | null;
  account_name: string | null;
  project_type_name: string | null;
  project_owned: string | null;
};

export function projectAttrFiltersActive(value: ProjectAttrValue): boolean {
  return Boolean(value.geo || value.region || value.account || value.projectType || value.ownership);
}

export function matchesProjectAttrs(row: ProjectAttrRow, value: ProjectAttrValue): boolean {
  if (value.geo && row.geo_name !== value.geo) return false;
  if (value.region && row.region_name !== value.region) return false;
  if (value.account && row.account_name !== value.account) return false;
  if (value.projectType && row.project_type_name !== value.projectType) return false;
  if (value.ownership && row.project_owned !== value.ownership) return false;
  return true;
}

function distinct(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
}

export function deriveProjectAttrOptions(rows: ProjectAttrRow[], value: ProjectAttrValue) {
  // Region options cascade off the selected Geo — mirrors ProjectHealthFilterBar.
  const regionRows = value.geo ? rows.filter((r) => r.geo_name === value.geo) : rows;
  // Account options cascade off the selected Geo and Region.
  const accountRows = regionRows.filter((r) => !value.region || r.region_name === value.region);
  return {
    geos: distinct(rows.map((r) => r.geo_name)),
    regions: distinct(regionRows.map((r) => r.region_name)),
    accounts: distinct(accountRows.map((r) => r.account_name)),
    projectTypes: distinct(rows.map((r) => r.project_type_name)),
    ownerships: distinct(rows.map((r) => r.project_owned)),
  };
}

export function ProjectAttrFilters({
  rows,
  value,
  onChange,
}: {
  rows: ProjectAttrRow[];
  value: ProjectAttrValue;
  onChange: (next: ProjectAttrValue) => void;
}) {
  const options = React.useMemo(() => deriveProjectAttrOptions(rows, value), [rows, value]);

  return (
    <>
      <div className="w-40 shrink-0">
        <NativeSelect
          aria-label="Geo filter"
          className="h-9 text-sm"
          value={value.geo ?? ""}
          onChange={(e) => onChange({ ...value, geo: e.target.value || undefined, region: undefined, account: undefined })}
        >
          <option value="">Geo [All]</option>
          {options.geos.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="w-44 shrink-0">
        <NativeSelect
          aria-label="Region filter"
          className="h-9 text-sm"
          value={value.region ?? ""}
          onChange={(e) => onChange({ ...value, region: e.target.value || undefined, account: undefined })}
        >
          <option value="">Region [All]</option>
          {options.regions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="w-48 shrink-0">
        <NativeSelect
          aria-label="Account filter"
          className="h-9 text-sm"
          value={value.account ?? ""}
          onChange={(e) => onChange({ ...value, account: e.target.value || undefined })}
        >
          <option value="">Account [All]</option>
          {options.accounts.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="w-44 shrink-0">
        <NativeSelect
          aria-label="Project Type filter"
          className="h-9 text-sm"
          value={value.projectType ?? ""}
          onChange={(e) => onChange({ ...value, projectType: e.target.value || undefined })}
        >
          <option value="">Project Type [All]</option>
          {options.projectTypes.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="w-44 shrink-0">
        <NativeSelect
          aria-label="Ownership filter"
          className="h-9 text-sm"
          value={value.ownership ?? ""}
          onChange={(e) => onChange({ ...value, ownership: e.target.value || undefined })}
        >
          <option value="">Ownership [All]</option>
          {options.ownerships.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </div>
    </>
  );
}
