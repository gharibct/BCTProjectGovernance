"use client";

import { NativeSelect } from "@/components/ui/native-select";
import { ProjectPicker } from "@/components/forms/project-picker";
import { FINDING_STATUS_OPTIONS, type PmFindingsFilter } from "@/lib/api/pm-findings";

const DEFAULTS: PmFindingsFilter = { status: "Active" };

// The list is scoped server-side (pm_findings._pm_scope): ADMIN sees every
// project's findings, every other role only their own. GET /projects applies
// the same scope, so the ProjectPicker naturally offers only projects whose
// findings the grid would show. (The KPI tiles + attention chips drive the
// `bucket`.)
export function PmFindingsFilterBar({
  filters,
  onChange,
}: {
  filters: PmFindingsFilter;
  onChange: (next: PmFindingsFilter) => void;
}) {
  const set = (patch: Partial<PmFindingsFilter>) => onChange({ ...filters, ...patch });

  const dirty = Boolean(filters.projectId || filters.bucket) || filters.status !== "Active";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">Filters</span>

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
