"use client";

import { NativeSelect } from "@/components/ui/native-select";
import { ProjectPicker } from "@/components/forms/project-picker";
import { useAccounts, useGeos, type Account, type Geo } from "@/lib/api/reference-data";
import {
  FINDING_CLASSIFICATION_OPTIONS,
  FINDING_STATUS_OPTIONS,
  type DeFindingsFilter,
} from "@/lib/api/de-findings";

const DEFAULTS: DeFindingsFilter = { status: "Active" };

// Portfolio-wide DE Findings filter bar — Geo / Account / Project /
// Classification / Status. Modeled on project-health-filter-bar.tsx. The
// Project field is a FilteredCombo (searchable, server-side) rather than a
// flat <select>, so it scales past the useProjects() 200-row cap.
export function DeFindingsFilterBar({
  filters,
  onChange,
  geos: geosOverride,
  accounts: accountsOverride,
}: {
  filters: DeFindingsFilter;
  onChange: (next: DeFindingsFilter) => void;
  // Restricts the Geo/Account pickers to a Geo Head's/Account Manager's own
  // patch (see DeFindingsView) — the backend enforces this scope regardless,
  // but without this a Geo Head/Account Manager could pick an out-of-patch
  // id and just get a 403 instead of a filtered list. DE/ADMIN/CDO get the
  // full portfolio list (no override passed).
  geos?: Geo[];
  accounts?: Account[];
}) {
  const { data: allGeos = [] } = useGeos();
  const { data: allAccounts = [] } = useAccounts();
  const geos = geosOverride ?? allGeos;
  const accounts = accountsOverride ?? allAccounts;

  const set = (patch: Partial<DeFindingsFilter>) => onChange({ ...filters, ...patch });

  const dirty =
    Boolean(filters.geoId || filters.accountId || filters.projectId || filters.classification || filters.bucket) ||
    filters.status !== "Active";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">Filters</span>

      <div className="w-36">
        <NativeSelect
          aria-label="Geo"
          className="h-9 bg-white text-sm"
          value={filters.geoId ?? ""}
          onChange={(e) => set({ geoId: e.target.value || undefined, accountId: undefined })}
        >
          <option value="">Geo [All]</option>
          {geos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="w-44">
        <NativeSelect
          aria-label="Account"
          className="h-9 bg-white text-sm"
          value={filters.accountId ?? ""}
          onChange={(e) => set({ accountId: e.target.value || undefined })}
        >
          <option value="">Account [All]</option>
          {accounts
            .filter((a) => !filters.geoId || a.geo_id === filters.geoId)
            .map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="w-80">
        <ProjectPicker
          label=""
          placeholder="Project [All]"
          value={filters.projectId ?? null}
          onChange={(id) => set({ projectId: id ?? undefined })}
        />
      </div>

      <div className="w-40">
        <NativeSelect
          aria-label="Classification"
          className="h-9 bg-white text-sm"
          value={filters.classification ?? ""}
          onChange={(e) => set({ classification: e.target.value || undefined })}
        >
          <option value="">Classification [All]</option>
          {FINDING_CLASSIFICATION_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="w-40">
        <NativeSelect
          aria-label="Status"
          className="h-9 bg-white text-sm"
          value={filters.status ?? "All"}
          onChange={(e) => set({ status: e.target.value })}
        >
          <option value="Active">Active</option>
          {FINDING_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="All">All</option>
        </NativeSelect>
      </div>

      {dirty ? (
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULTS })}
          className="ml-auto text-sm font-semibold text-[#1a6fc4] hover:underline"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
