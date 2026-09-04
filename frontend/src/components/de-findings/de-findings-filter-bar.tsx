"use client";

import { NativeSelect } from "@/components/ui/native-select";
import { useAccounts, useGeos } from "@/lib/api/reference-data";
import { useProjects } from "@/lib/api/projects";
import {
  FINDING_CLASSIFICATION_OPTIONS,
  FINDING_STATUS_OPTIONS,
  type DeFindingsFilter,
} from "@/lib/api/de-findings";

const DEFAULTS: DeFindingsFilter = { status: "Active" };

// Portfolio-wide DE Findings filter bar — Geo / Account / Project /
// Classification / Status. Modeled on project-health-filter-bar.tsx. The
// Project <select> lists useProjects()'s first 200 (its hard cap) — acceptable
// for the current portfolio. (Free-text search is supported by the API but
// intentionally not surfaced here.)
export function DeFindingsFilterBar({
  filters,
  onChange,
}: {
  filters: DeFindingsFilter;
  onChange: (next: DeFindingsFilter) => void;
}) {
  const { data: geos = [] } = useGeos();
  const { data: accounts = [] } = useAccounts();
  const { data: projects = [] } = useProjects();

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
          onChange={(e) => set({ geoId: e.target.value || undefined })}
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
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="w-52">
        <NativeSelect
          aria-label="Project"
          className="h-9 bg-white text-sm"
          value={filters.projectId ?? ""}
          onChange={(e) => set({ projectId: e.target.value || undefined })}
        >
          <option value="">Project [All]</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_code} · {p.project_name}
            </option>
          ))}
        </NativeSelect>
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
          onChange={(e) => set({ status: e.target.value === "All" ? undefined : e.target.value })}
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
