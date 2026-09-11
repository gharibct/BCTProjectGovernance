"use client";

import * as React from "react";

import {
  effectiveProjectStatus,
  fetchProjectById,
  fetchProjectOptions,
  type Project,
  type ProjectStatus,
} from "@/lib/api/projects";
import { useAccounts, useGeos } from "@/lib/api/reference-data";
import { FilteredCombo, type ComboItem } from "@/components/forms/filtered-combo";

// Ready-to-use project selector built on FilteredCombo: a searchable combo plus
// a Geo / Account / name-search filter popup, all resolved server-side via
// GET /projects?geo_id=&account_id=&search=. Use this wherever a plain
// <select> over every project would be too long. (Mirrors how ResourcePicker
// is the usable person-picker over the generic combo internals.)

export function ProjectPicker({
  value,
  onChange,
  label = "Project",
  placeholder = "Select a project…",
  required = false,
  disabled = false,
  id,
  className,
  excludeStatus,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  // Omit projects in this approval-workflow status from the results, e.g.
  // "Draft" for pickers that must only target already-submitted projects.
  excludeStatus?: ProjectStatus;
}) {
  const { data: geos = [] } = useGeos();
  const { data: accounts = [] } = useAccounts();

  const geoName = React.useCallback(
    (gid: string | null) => geos.find((g) => g.id === gid)?.name ?? null,
    [geos],
  );
  const accountName = React.useCallback(
    (aid: string | null) => accounts.find((a) => a.id === aid)?.name ?? null,
    [accounts],
  );

  const toItem = React.useCallback(
    (p: Project): ComboItem => ({
      id: p.id,
      primary: `${p.project_code} · ${p.project_name}`,
      secondary: [accountName(p.account_id), geoName(p.geo_id)].filter(Boolean).join(" • ") || undefined,
      tag: effectiveProjectStatus(p),
    }),
    [accountName, geoName],
  );

  return (
    <FilteredCombo
      value={value}
      onChange={onChange}
      label={label}
      required={required}
      disabled={disabled}
      id={id}
      className={className}
      placeholder={placeholder}
      searchPlaceholder="Search projects…"
      searchLabel="Project name / code"
      // geos/accounts length in the key so the display names refresh once the
      // reference data resolves.
      queryKey={["projects", "filtered-combo", geos.length, accounts.length, excludeStatus ?? ""]}
      facets={[
        {
          key: "geo_id",
          label: "Geo",
          options: geos.map((g) => ({ value: g.id, label: g.name })),
          clearsOnChangeOf: ["account_id"],
        },
        {
          key: "account_id",
          label: "Account",
          options: (draft) =>
            accounts
              .filter((a) => !draft.geo_id || a.geo_id === draft.geo_id)
              .map((a) => ({ value: a.id, label: a.name })),
        },
      ]}
      fetchOptions={async ({ search, filters, limit }) => {
        const page = await fetchProjectOptions({
          search,
          filters: { geo_id: filters.geo_id, account_id: filters.account_id },
          limit,
          excludeStatus,
        });
        return { items: page.items.map(toItem), total: page.total };
      }}
      resolveSelected={async (id) => toItem(await fetchProjectById(id))}
    />
  );
}
