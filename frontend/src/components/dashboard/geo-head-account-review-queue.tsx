import Link from "next/link";

import { cn } from "@/lib/utils";
import type { AccountReviewQueueRow } from "@/lib/api/geo-head-dashboard";
import type { HealthRating } from "@/lib/api/projects";

// "Account Report Review Queue" (design-reference/geohead-mysummary.jpg) —
// Account Status Reports submitted by Account Heads and still awaiting this
// Geo Head's approve/reject (see backend's AccountStatusReport.status ==
// Submitted), one tier above AccountHeadReportReviewQueue's project-level
// queue. The Action column links into the account's own review page rather
// than duplicating its approve/reject controls here.

const HEALTH_DOT_CLASS: Record<HealthRating, string> = {
  Red: "bg-red-600",
  "Potential Red": "bg-orange-500",
  Amber: "bg-amber-500",
  Green: "bg-emerald-500",
};

function HealthDot({ health }: { health: HealthRating | null }) {
  if (!health) {
    return <span className="text-sm text-slate-400">—</span>;
  }
  return <span className={cn("inline-block size-2.5 rounded-full", HEALTH_DOT_CLASS[health])} />;
}

function formatAge(value: string): string {
  const ms = Date.now() - new Date(value).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hr${hours !== 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

export function GeoHeadAccountReviewQueue({ rows }: { rows: AccountReviewQueueRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <div>
          <h2 className="font-bold text-slate-900">Account Report Review Queue</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Account Status Reports submitted by Account Heads requiring your approval.
          </p>
        </div>
        {rows.length > 0 ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {rows.length} Pending
          </span>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">Nothing awaiting your review.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                <th className="min-w-[180px] px-5 py-3">Account</th>
                <th className="min-w-[140px] px-3 py-3">Head</th>
                <th className="min-w-[80px] px-3 py-3">Health</th>
                <th className="min-w-[80px] px-3 py-3">Age</th>
                <th className="min-w-[100px] px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.account_id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                  <td className="px-5 py-2.5 font-semibold text-slate-900">
                    <Link href={row.href} className="hover:underline">
                      {row.account_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{row.account_head_name ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <HealthDot health={row.health} />
                  </td>
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
