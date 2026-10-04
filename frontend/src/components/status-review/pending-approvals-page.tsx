"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { usePendingApprovals, type PendingApprovalScope } from "@/lib/api/pending-approvals";

const COPY: Record<PendingApprovalScope, { title: string; entity: string; href: string; showCode: boolean }> = {
  projects: {
    title: "Approve Project Delivery Status",
    entity: "Project",
    href: "/project-approval",
    showCode: true,
  },
  accounts: {
    title: "Approve Account Delivery Status",
    entity: "Account",
    href: "/account-approval",
    showCode: false,
  },
};

// Worklist of the reports awaiting this reviewer's decision (one row per
// project/account + period). Picking a row opens that report's approve page.
export function PendingApprovalsPage({ scope }: { scope: PendingApprovalScope }) {
  const router = useRouter();
  const copy = COPY[scope];
  const { data: rows = [], isLoading, isError } = usePendingApprovals(scope);

  const open = (entityId: string, periodId: string) =>
    router.push(`${copy.href}/${entityId}?period=${periodId}`);

  return (
    <main className="min-w-0 flex-1 bg-gradient-to-br from-sky-100/70 via-blue-50/40 to-white px-10 py-8">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <header>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">{copy.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {copy.entity === "Project" ? "Projects" : "Accounts"} with a submitted report awaiting your approval.
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          {isError ? (
            <p className="text-sm text-red-600">Couldn&apos;t load pending approvals.</p>
          ) : isLoading ? (
            <p className="text-slate-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm font-semibold text-emerald-700">
              All approved — no {copy.entity.toLowerCase()} reports are pending approval.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#D0D9E2]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#8EBBE0] bg-[#D6E9F8] text-xs font-bold tracking-wide text-[#205889] uppercase">
                    <th className="px-4 py-3">Actions</th>
                    {copy.showCode ? <th className="px-3 py-3">Project Code</th> : null}
                    <th className="px-3 py-3">{copy.entity} Name</th>
                    <th className="px-3 py-3">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.report_id}
                      onClick={() => open(r.entity_id, r.period_id)}
                      className="cursor-pointer border-b border-[#E4E9EE] bg-white last:border-b-0 even:bg-[#F8FAFB] hover:bg-[#EDF3F7]"
                    >
                      <td className="px-4 py-2.5">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            open(r.entity_id, r.period_id);
                          }}
                          className="bg-[#1a4a7a] font-semibold text-white hover:bg-[#15406b]"
                        >
                          Review
                        </Button>
                      </td>
                      {copy.showCode ? (
                        <td className="px-3 py-2.5 font-mono text-[#1a6fc4]">{r.entity_code}</td>
                      ) : null}
                      <td className="px-3 py-2.5 text-[#172033]">{r.entity_name}</td>
                      <td className="px-3 py-2.5 text-[#172033]">
                        {r.period_label} ({r.period_type})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
