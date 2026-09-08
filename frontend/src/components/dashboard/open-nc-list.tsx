import Link from "next/link";

import { cn } from "@/lib/utils";
import type { OpenNcRow } from "@/lib/api/dashboard";

// "Open Alerts" list — open DE assessment findings classified as Alert, shown
// as the last section on the PM, Account and CXO dashboards. On the Account/CXO
// dashboards `showAccount` adds an Account column, since the list there rolls
// up across every in-scope project.

const STATUS_CLASS: Record<string, string> = {
  Open: "bg-red-50 text-red-700 ring-red-200",
  "In Progress": "bg-amber-50 text-amber-700 ring-amber-200",
  "Awaiting Closure": "bg-blue-50 text-blue-700 ring-blue-200",
  "On Hold": "bg-slate-100 text-slate-600 ring-slate-200",
  Deferred: "bg-slate-100 text-slate-600 ring-slate-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        STATUS_CLASS[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"
      )}
    >
      {status}
    </span>
  );
}

function formatDate(value: string | null): string {
  return value
    ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "—";
}

export function OpenNcList({ rows, showAccount = false }: { rows: OpenNcRow[]; showAccount?: boolean }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3.5">
        <h2 className="font-bold text-slate-900">Open Alerts</h2>
        <p className="mt-0.5 text-sm text-slate-400">
          Open Delivery Excellence findings classified as Alert
          {showAccount ? ", across every project in scope" : ""}.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">No open alerts.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                <th className="min-w-[200px] px-5 py-3">Project</th>
                {showAccount ? <th className="min-w-[140px] px-3 py-3">Account</th> : null}
                <th className="min-w-[130px] px-3 py-3">Category</th>
                <th className="min-w-[240px] px-3 py-3">Finding</th>
                <th className="min-w-[130px] px-3 py-3">Owner</th>
                <th className="min-w-[110px] px-3 py-3">Raised</th>
                <th className="min-w-[110px] px-3 py-3">Due</th>
                <th className="min-w-[70px] px-3 py-3">Age</th>
                <th className="min-w-[120px] px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.finding_id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                  <td className="px-5 py-2.5 font-semibold text-slate-900">
                    <Link href={`/project-review/${row.project_id}`} className="hover:underline">
                      {row.project_label}
                    </Link>
                  </td>
                  {showAccount ? (
                    <td className="px-3 py-2.5 text-slate-600">{row.account_name ?? "—"}</td>
                  ) : null}
                  <td className="px-3 py-2.5 text-slate-600">{row.category}</td>
                  <td className="px-3 py-2.5 text-slate-600">
                    <span className="line-clamp-2 max-w-md">{row.description || "—"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{row.owner_name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{formatDate(row.finding_date)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{formatDate(row.due_date)}</td>
                  <td className="px-3 py-2.5 font-semibold text-amber-600">
                    {row.age_days === null ? "—" : `${row.age_days}d`}
                  </td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={row.status} />
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
