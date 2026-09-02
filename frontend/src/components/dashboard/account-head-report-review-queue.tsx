import Link from "next/link";

import { cn } from "@/lib/utils";
import type { ReportReviewQueueRow } from "@/lib/api/account-head-dashboard";
import type { HealthRating } from "@/lib/api/projects";

// "Report Review Queue" (design-reference/acchead-mysummary.jpg) — Project
// Status Reports submitted by PMs and still awaiting this Account Head's
// approve/reject (see backend's ProjectStatusReport.status == Submitted).
// The Action column links into the existing per-project review page
// (StatusReviewPage, scope="project") rather than duplicating its
// approve/reject controls here.

const HEALTH_BADGE_CLASS: Record<HealthRating, string> = {
  Red: "bg-red-50 text-red-700 ring-red-200",
  "Potential Red": "bg-orange-50 text-orange-700 ring-orange-200",
  Amber: "bg-amber-50 text-amber-700 ring-amber-200",
  Green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

function HealthBadge({ health }: { health: HealthRating | null }) {
  if (!health) {
    return <span className="text-sm text-slate-400">—</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        HEALTH_BADGE_CLASS[health]
      )}
    >
      {health}
    </span>
  );
}

function formatSubmitted(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAge(value: string): string {
  const ms = Date.now() - new Date(value).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hr${hours !== 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

export function AccountHeadReportReviewQueue({ rows }: { rows: ReportReviewQueueRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <div>
          <h2 className="font-bold text-slate-900">Report Review Queue</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Project Status Reports submitted by PMs requiring Account Head approval.
          </p>
        </div>
        {rows.length > 0 ? (
          <Link href={rows[0].href} className="shrink-0 text-sm font-semibold text-[#1a6fc4] hover:underline">
            View All →
          </Link>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">Nothing awaiting your review.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                <th className="min-w-[220px] px-5 py-3">Project Name</th>
                <th className="min-w-[140px] px-3 py-3">Project Manager</th>
                <th className="min-w-[110px] px-3 py-3">Period</th>
                <th className="min-w-[90px] px-3 py-3">Health</th>
                <th className="min-w-[140px] px-3 py-3">Submitted</th>
                <th className="min-w-[80px] px-3 py-3">Age</th>
                <th className="min-w-[100px] px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.report_id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                  <td className="px-5 py-2.5 font-semibold text-slate-900">
                    <Link href={row.href} className="hover:underline">
                      {row.project_label}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{row.project_manager_name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{row.period_label}</td>
                  <td className="px-3 py-2.5">
                    <HealthBadge health={row.health} />
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{formatSubmitted(row.submitted_at)}</td>
                  <td className="px-3 py-2.5 font-semibold text-amber-600">{formatAge(row.submitted_at)}</td>
                  <td className="px-5 py-2.5">
                    <Link href={row.href} className="font-semibold text-[#1a6fc4] hover:underline">
                      Review →
                    </Link>
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
