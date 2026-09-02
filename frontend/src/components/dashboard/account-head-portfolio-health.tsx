import Link from "next/link";

import { cn } from "@/lib/utils";
import type { AccountPortfolioHealthRow } from "@/lib/api/account-head-dashboard";

// "Account Portfolio Health" (design-reference/acchead-mysummary.jpg) —
// per-account project counts + health split, with a left-border/status badge
// keyed off the account's own latest health declaration rating (see
// services/dashboard.py's account_portfolio_health), independent of how its
// projects individually roll up.

const STATUS_CLASS: Record<string, { border: string; text: string }> = {
  "On Track": { border: "border-l-emerald-500", text: "text-emerald-600" },
  "At Risk": { border: "border-l-amber-400", text: "text-amber-600" },
  Critical: { border: "border-l-red-600", text: "text-red-600" },
  "Not Rated": { border: "border-l-slate-300", text: "text-slate-400" },
};

export function AccountHeadPortfolioHealth({ rows }: { rows: AccountPortfolioHealthRow[] }) {
  const style = (label: string) => STATUS_CLASS[label] ?? STATUS_CLASS["Not Rated"];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">Account Portfolio Health</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No accounts assigned to you yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.account_id}>
              <Link
                href={`/account-review/${row.account_id}`}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-lg border border-slate-200 border-l-4 px-4 py-3 hover:bg-slate-50/70",
                  style(row.status_label).border
                )}
              >
                <div>
                  <div className="font-semibold text-slate-900">{row.account_name}</div>
                  <div className="text-sm text-slate-400">{row.active_projects_count} Active Projects</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="text-emerald-600">{row.health_green}</span>
                    <span className="text-amber-500">{row.health_amber}</span>
                    <span className="text-orange-600">{row.health_potential_red}</span>
                    <span className="text-red-600">{row.health_red}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold tracking-wide text-slate-500 uppercase">Status</div>
                    <div className={cn("text-sm font-bold", style(row.status_label).text)}>{row.status_label}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
