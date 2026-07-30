"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  projectCount,
  type Health,
  type ProjectFilter,
  type ProjectRow,
} from "./data";

const HEALTH_STYLES: Record<
  Health,
  { label: string; dot: string; badge: string }
> = {
  red: {
    label: "Red",
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-700",
  },
  "potential-red": {
    label: "Potential Red",
    dot: "bg-orange-500",
    badge: "bg-orange-100 text-orange-700",
  },
  amber: {
    label: "Amber",
    dot: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700",
  },
  green: {
    label: "Green",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
  },
};

const FILTER_LABELS: Record<ProjectFilter, string> = {
  all: "All active projects",
  red: "Red projects",
  "potential-red": "Potential red projects",
  amber: "Amber projects",
  green: "Green projects",
  "status-pending": "Status report overdue",
};

const PRIORITY_CLASSES: Record<ProjectRow["priority"], string> = {
  P0: "bg-red-50 text-red-700",
  P1: "bg-orange-50 text-orange-700",
  P2: "bg-slate-100 text-slate-600",
  P3: "bg-slate-100 text-slate-500",
};

export function ProjectDetails({
  filter,
  projects,
  loading,
}: {
  filter: ProjectFilter;
  projects: ProjectRow[];
  loading: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <h2 className="flex items-center gap-3 text-lg font-bold text-slate-900">
          Project Details
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {FILTER_LABELS[filter]} · {projectCount(filter)}
          </span>
        </h2>
      </div>

      {/* Height capped at ~5 rows; the rest scrolls under the sticky header. */}
      <div className="max-h-[368px] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.slate.200)]">
            <tr className="text-xs tracking-wide text-slate-500 uppercase">
              <th className="px-6 py-3 font-bold">Project</th>
              <th className="px-3 py-3 font-bold">Health</th>
              <th className="px-3 py-3 font-bold">Critical Reason</th>
              <th className="px-6 py-3 font-bold">Priority</th>
            </tr>
          </thead>
          <tbody aria-busy={loading}>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td colSpan={4} className="px-6 py-4">
                    <div className="h-4 animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))
            ) : projects.length === 0 ? (
              <tr className="border-t border-slate-100">
                <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                  No projects match this view.
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                >
                  <td className="px-6 py-3.5">
                    <Link
                      href="/project-charter"
                      className="font-semibold text-[#1a6fc4] hover:underline"
                    >
                      {project.name}
                    </Link>
                    <div className="font-mono text-xs text-slate-400">
                      {project.id}
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase whitespace-nowrap",
                        HEALTH_STYLES[project.health].badge
                      )}
                    >
                      {HEALTH_STYLES[project.health].label}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-slate-700">
                    {project.criticalReason}
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-bold",
                        PRIORITY_CLASSES[project.priority]
                      )}
                    >
                      {project.priority}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
