import Link from "next/link";
import { AlertTriangle, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GovernanceComplianceRow, GovernanceStatus } from "@/lib/api/pmo-dashboard";

// "Governance Compliance" grid (design-reference/pmo-mysummary.jpg) — one row
// per org-wide project across the 5 categories PMO tracks compliance on
// (Reporting/Measurement/Contractual/RAIDO/Assessment), reduced to
// Compliant/Minor Gap/Major Gap each (see services/dashboard.py's
// pmo_governance_compliance_matrix), plus an Overall Status dot that's the
// worst of the 5.

function StatusCell({ status }: { status: GovernanceStatus }) {
  if (status === "Compliant") {
    return <Check className="size-4 text-emerald-600" aria-label="Compliant" />;
  }
  if (status === "Minor Gap") {
    return <AlertTriangle className="size-4 text-amber-500" aria-label="Minor Gap" />;
  }
  return <span className="inline-block size-2.5 rounded-full bg-red-600" aria-label="Major Gap" />;
}

const OVERALL_DOT_CLASS: Record<GovernanceStatus, string> = {
  Compliant: "bg-emerald-500",
  "Minor Gap": "bg-amber-400",
  "Major Gap": "bg-red-600",
};

export function GovernanceComplianceTable({ rows }: { rows: GovernanceComplianceRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
        <h2 className="font-bold text-slate-900">Governance Compliance</h2>
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5">
            <Check className="size-3.5 text-emerald-600" /> Compliant
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-amber-500" /> Minor Gap
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-red-600" /> Major Gap
          </span>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">No projects in scope.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                <th className="min-w-[220px] px-5 py-3">Project</th>
                <th className="min-w-[90px] px-3 py-3 text-center">Reporting</th>
                <th className="min-w-[100px] px-3 py-3 text-center">Measurement</th>
                <th className="min-w-[100px] px-3 py-3 text-center">Contractual</th>
                <th className="min-w-[80px] px-3 py-3 text-center">RAIDO</th>
                <th className="min-w-[90px] px-3 py-3 text-center">Assessment</th>
                <th className="min-w-[100px] px-3 py-3 text-center">Overall Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.project_id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                  <td className="px-5 py-2.5">
                    <Link href={row.href} className="font-semibold text-slate-900 hover:underline">
                      {row.project_name}
                    </Link>
                    <div className="text-sm text-slate-400">{row.project_code}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center">
                      <StatusCell status={row.reporting_status} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center">
                      <StatusCell status={row.measurement_status} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center">
                      <StatusCell status={row.contractual_status} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center">
                      <StatusCell status={row.raido_status} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center">
                      <StatusCell status={row.assessment_status} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center">
                      <span
                        className={cn(
                          "inline-block size-3 rounded-full",
                          OVERALL_DOT_CLASS[row.overall_status]
                        )}
                        title={row.overall_status}
                      />
                    </div>
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
