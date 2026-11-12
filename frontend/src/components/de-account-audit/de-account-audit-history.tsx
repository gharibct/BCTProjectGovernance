"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { History } from "lucide-react";

import { SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { PageBreadcrumb } from "@/components/shell/page-breadcrumb";
import { HealthDot } from "@/components/de-assessment-workspace/shared";
import { formatDate } from "@/components/dashboard/project-health-kpi";
import { useDeAccountAuditQueue, useDeAccountAudits } from "@/lib/api/de-account-audit";
import { useReportingPeriods } from "@/lib/api/reference-data";

// Account Assessment History — every submitted DE audit of one account. Mirrors
// the Project Assessment history screen; reached from the queue's History link.
export function DeAccountAuditHistory() {
  const { accountId } = useParams<{ accountId: string }>();
  const { data: queue } = useDeAccountAuditQueue();
  const account = queue?.rows.find((r) => r.account_id === accountId);
  const { data: audits = [] } = useDeAccountAudits(accountId);
  const { data: periods = [] } = useReportingPeriods();

  const submitted = React.useMemo(
    () =>
      audits
        .filter((a) => a.status === "Submitted")
        .sort((a, b) => (b.audit_date ?? "").localeCompare(a.audit_date ?? "")),
    [audits],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageBreadcrumb
          items={[{ label: "Account Assessment", href: "/de-account-audit" }, { label: "History" }]}
        />
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Assessment History — {account?.account_name ?? "…"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">All submitted Delivery Excellence assessments for this account</p>
      </div>

      <SectionCard icon={History} title="Assessments">
        {submitted.length === 0 ? (
          <EmptyState>No assessments have been submitted for this account yet.</EmptyState>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#8EBBE0] bg-[#D6E9F8] text-xs font-bold tracking-wide text-[#205889] uppercase">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Period</th>
                <th className="py-2 pr-3">Assessed By</th>
                <th className="py-2 pr-3">DE Health</th>
                <th className="py-2">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {submitted.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 align-top last:border-b-0">
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-700">{formatDate(a.audit_date)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-700">
                    {periods.find((p) => p.id === a.period_id)?.label ?? "—"}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-700">{a.audited_by_name ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-2">
                      <HealthDot health={a.de_assessed_health} />
                      {a.de_assessed_health}
                    </span>
                  </td>
                  <td className="py-2 whitespace-pre-wrap text-slate-600">{a.remarks ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
