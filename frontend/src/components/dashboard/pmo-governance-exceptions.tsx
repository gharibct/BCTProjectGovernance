import Link from "next/link";

import { cn } from "@/lib/utils";
import type { GovernanceExceptionRow } from "@/lib/api/pmo-dashboard";

// "Governance Exceptions" (design-reference/pmo-mysummary.jpg) — one row per
// non-compliant category per org-wide project, oldest/most-overdue first
// (see services/dashboard.py's pmo_governance_exceptions).

const EXCEPTION_BADGE_CLASS: Record<string, string> = {
  "Missing Reporting": "bg-red-50 text-red-700",
  "Overdue Actions": "bg-red-50 text-red-700",
  "Contractual Not Met": "bg-red-50 text-red-700",
  "DE Assessment Overdue": "bg-red-50 text-red-700",
  "Stale RAIDO": "bg-sky-50 text-sky-700",
  "Missing Measurements": "bg-sky-50 text-sky-700",
};

function badgeClass(exception: string): string {
  if (EXCEPTION_BADGE_CLASS[exception]) return EXCEPTION_BADGE_CLASS[exception];
  return exception.startsWith("Overdue Actions") ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600";
}

export function GovernanceExceptions({ rows }: { rows: GovernanceExceptionRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <h2 className="font-bold text-slate-900">Governance Exceptions</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">No governance exceptions — every project is compliant.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                <th className="min-w-[180px] px-5 py-3">Project</th>
                <th className="min-w-[140px] px-3 py-3">Account</th>
                <th className="min-w-[160px] px-3 py-3">Exception</th>
                <th className="min-w-[80px] px-3 py-3">Age</th>
                <th className="min-w-[70px] px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.project_id}-${row.exception}-${index}`}
                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                >
                  <td className="px-5 py-2.5">
                    <div className="font-semibold text-slate-900">{row.project_code}</div>
                    <div className="text-sm text-slate-400">{row.project_name}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{row.account_name ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold",
                        badgeClass(row.exception)
                      )}
                    >
                      {row.exception}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {row.age_days} Day{row.age_days !== 1 ? "s" : ""}
                  </td>
                  <td className="px-5 py-2.5">
                    <Link href={row.href} className="text-sm font-semibold text-[#1a6fc4] hover:underline">
                      View
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
