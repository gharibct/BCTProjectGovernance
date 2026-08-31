import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DEAssessmentWorkQueueRow } from "@/lib/api/de-dashboard";
import type { HealthRating } from "@/lib/api/projects";

// "Assessment Work Queue" (design-reference/de-mysummary.jpg) — in-scope
// projects for the selected Assessment Period, left-joined to that period's
// DEAssessment (if any). Status is derived (Not Started / Submitted), since
// DEAssessment itself has no status field — see services/dashboard.py's
// de_assessment_work_queue.

const HEALTH_DOT_CLASS: Record<HealthRating, string> = {
  Red: "bg-red-600",
  "Potential Red": "bg-red-600",
  Amber: "bg-amber-500",
  Green: "bg-emerald-500",
};

function HealthDot({ health }: { health: HealthRating | null }) {
  if (!health) {
    return <span className="text-sm text-slate-400">—</span>;
  }
  return <span className={cn("inline-block size-2.5 rounded-full", HEALTH_DOT_CLASS[health])} />;
}

const STATUS_BADGE_CLASS: Record<DEAssessmentWorkQueueRow["status"], string> = {
  "Not Started": "bg-slate-100 text-slate-600",
  Draft: "bg-amber-50 text-amber-700",
  Submitted: "bg-emerald-50 text-emerald-700",
};

export function DeAssessmentWorkQueue({ rows }: { rows: DEAssessmentWorkQueueRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <h2 className="font-bold text-slate-900">Assessment Work Queue</h2>
        <Link
          href="/de-assessment"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#1a6fc4] hover:underline"
        >
          View All
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">No projects in scope for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                <th className="min-w-[220px] px-5 py-3">Project</th>
                <th className="min-w-[90px] px-3 py-3">PM Health</th>
                <th className="min-w-[90px] px-3 py-3">DE Health</th>
                <th className="min-w-[70px] px-3 py-3">PCI</th>
                <th className="min-w-[110px] px-3 py-3">Status</th>
                <th className="min-w-[100px] px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.project_id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                  <td className="px-5 py-2.5">
                    <div className="font-semibold text-slate-900">{row.project_name}</div>
                    <div className="text-sm text-slate-400">
                      {[row.project_manager_name, row.account_name].filter(Boolean).join(" • ")}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <HealthDot health={row.pm_health} />
                  </td>
                  <td className="px-3 py-2.5">
                    <HealthDot health={row.de_health} />
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{row.pci_score ? `${row.pci_score}%` : "—"}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold",
                        STATUS_BADGE_CLASS[row.status]
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    {row.status === "Submitted" ? (
                      <Link
                        href={row.href}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </Link>
                    ) : (
                      <Link
                        href={row.href}
                        className="rounded-md bg-[#1a6fc4] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a6fc4]/90"
                      >
                        {row.status === "Draft" ? "Continue" : "Assess"}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
