import Link from "next/link";

import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/components/project-charter/health-declaration";
import { RagCell } from "./governance-matrix";
import type { MyProjectHealthRow } from "@/lib/api/pm-dashboard";

// "My Projects Health" (design-reference/pm-mysummary.jpg) — same RagCell
// dot pattern as GovernanceMatrix (Overall + all 6 categories, per the
// decision to use the app's real health model rather than the mockup's
// invented 3-column Sch/Fin/Del layout), plus a Report Status badge column
// GovernanceMatrix has no equivalent of.

const REPORT_STATUS_CLASS: Record<string, string> = {
  Submitted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Draft: "bg-slate-100 text-slate-600 ring-slate-200",
  "Due Today": "bg-blue-50 text-blue-700 ring-blue-200",
  "Not Submitted": "bg-red-50 text-red-700 ring-red-200",
};

function ReportStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        REPORT_STATUS_CLASS[status] ?? REPORT_STATUS_CLASS["Not Submitted"]
      )}
    >
      {status}
    </span>
  );
}

export function PmMyProjectsHealthTable({ rows }: { rows: MyProjectHealthRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3.5">
        <h2 className="font-bold text-slate-900">My Projects Health</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">No projects assigned to you yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                <th className="min-w-[200px] px-5 py-3">Project</th>
                <th className="min-w-[90px] px-3 py-3 text-center">Overall</th>
                {CATEGORIES.map((category) => (
                  <th key={category.key} className="min-w-[100px] px-3 py-3 text-center">
                    {category.name}
                  </th>
                ))}
                <th className="min-w-[130px] px-5 py-3">Report Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.entity_id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                  <td className="px-5 py-2.5 font-semibold text-slate-900">
                    <Link href={`/project-review/${row.entity_id}`} className="hover:underline">
                      {row.entity_label}
                    </Link>
                    {row.account_name ? <div className="text-xs font-normal text-slate-400">{row.account_name}</div> : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <RagCell rating={row.overall_rating} />
                  </td>
                  {CATEGORIES.map((category) => (
                    <td key={category.key} className="px-3 py-2.5">
                      <RagCell rating={row[category.ratingField]} />
                    </td>
                  ))}
                  <td className="px-5 py-2.5">
                    <ReportStatusBadge status={row.report_status} />
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
