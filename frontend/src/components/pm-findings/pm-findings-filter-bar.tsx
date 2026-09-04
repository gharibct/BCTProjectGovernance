"use client";

import { NativeSelect } from "@/components/ui/native-select";
import { useProjects } from "@/lib/api/projects";
import { useSession } from "@/stores/session";
import { FINDING_STATUS_OPTIONS, type PmFindingsFilter } from "@/lib/api/pm-findings";

const DEFAULTS: PmFindingsFilter = { status: "Active" };

// The list is already scoped server-side to the caller's own projects, so this
// only needs Project / Status (the KPI tiles + attention chips drive the `bucket`).
export function PmFindingsFilterBar({
  filters,
  onChange,
}: {
  filters: PmFindingsFilter;
  onChange: (next: PmFindingsFilter) => void;
}) {
  const userId = useSession((s) => s.user?.id);
  const { data: projects = [] } = useProjects();
  const myProjects = projects.filter((p) => p.project_manager_id === userId);

  const set = (patch: Partial<PmFindingsFilter>) => onChange({ ...filters, ...patch });

  const dirty = Boolean(filters.projectId || filters.bucket) || filters.status !== "Active";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">Filters</span>

      <div className="w-56">
        <NativeSelect
          aria-label="Project"
          className="h-9 bg-white text-sm"
          value={filters.projectId ?? ""}
          onChange={(e) => set({ projectId: e.target.value || undefined })}
        >
          <option value="">Project [All]</option>
          {myProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_code} · {p.project_name}
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
