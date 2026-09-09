"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ChevronRight, FileText, History, Milestone } from "lucide-react";

import {
  useCommitmentActuals,
  useCommitments,
  useLatestCommitmentActuals,
  useMilestonePayments,
  type ContractualCommitment,
} from "@/lib/api/contractual";
import { useUsersByIds } from "@/lib/api/reference-data";
import { formatDate, formatDateTime } from "@/components/dashboard/project-health-kpi";
import { SectionCard } from "@/components/forms/form-primitives";
import { RegisterTable } from "@/components/forms/register-table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function ContractualView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: commitments = [] } = useCommitments(projectId ?? null);
  const { data: milestones = [] } = useMilestonePayments(projectId ?? null);
  const actualsByCommitment = useLatestCommitmentActuals(
    projectId ?? null,
    commitments.map((c) => c.id)
  );
  const [openFor, setOpenFor] = React.useState<ContractualCommitment | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <SectionCard icon={FileText} title="Contractual Commitments">
        <RegisterTable
          items={commitments}
          emptyLabel="No commitments recorded."
          onRowClick={(c) => setOpenFor(c)}
          columns={[
            { key: "commitment_name", label: "Commitment" },
            { key: "frequency", label: "Frequency" },
            { key: "target", label: "Target", align: "right" },
            {
              key: "actual_value",
              label: "Actual",
              align: "right",
              render: (item) => actualsByCommitment[item.id]?.latest?.actual_value ?? "—",
            },
            {
              key: "penalty_applicable",
              label: "Penalty",
              render: (item) => (item.penalty_applicable ? "Yes" : "No"),
            },
            { key: "penalty_value", label: "Penalty Value", align: "right" },
            {
              key: "history",
              label: "History",
              align: "right",
              render: (item) => {
                const count = actualsByCommitment[item.id]?.count ?? 0;
                return (
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <span
                      className={
                        count > 0
                          ? "inline-flex min-w-[1.5rem] justify-center rounded-full bg-[#d9eafc] px-2 py-0.5 text-xs font-semibold text-[#15406b]"
                          : "text-xs text-slate-400"
                      }
                    >
                      {count > 0 ? count : "—"}
                    </span>
                    <ChevronRight className="size-4 text-slate-400" />
                  </span>
                );
              },
            },
          ]}
        />
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <History className="size-3.5" />
          Select a commitment row to view its recorded compliance actual history.
        </p>
      </SectionCard>

      <SectionCard icon={Milestone} title="Milestone Payments">
        <RegisterTable
          items={milestones}
          emptyLabel="No milestone payments recorded."
          columns={[
            { key: "milestone_name", label: "Payment Milestone" },
            { key: "expected_date_of_payment", label: "Expected Date" },
            { key: "expected_payment_value", label: "Expected Value", align: "right" },
            { key: "milestone_description", label: "Description" },
          ]}
        />
      </SectionCard>

      <Sheet open={!!openFor} onOpenChange={(open) => !open && setOpenFor(null)}>
        {openFor && projectId ? (
          <CommitmentActualsHistoryDrawer projectId={projectId} commitment={openFor} />
        ) : null}
      </Sheet>
    </div>
  );
}

// Read-only compliance actual history for one commitment — every reading
// recorded during monthly Project Reporting (newest first, server-ordered).
// The DE project view is read-only, so this only lists the history; actuals
// are captured / edited on Project Reporting → Contractual Compliance.
function CommitmentActualsHistoryDrawer({
  projectId,
  commitment,
}: {
  projectId: string;
  commitment: ContractualCommitment;
}) {
  const { data: actuals = [], isLoading } = useCommitmentActuals(projectId, commitment.id, true);
  const users = useUsersByIds(actuals.map((a) => a.recorded_by));
  const userName = (id: string | null) =>
    id ? (users.data?.find((u) => u.id === id)?.full_name ?? "—") : "—";

  return (
    <SheetContent className="gap-0 p-0 sm:w-[560px] lg:w-[46%]">
      <SheetHeader>
        <SheetTitle>Compliance Actual History — {commitment.commitment_name}</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 text-xs text-slate-500">
          {commitment.frequency} cadence · {actuals.length} recorded
        </p>

        <RegisterTable
          items={actuals}
          emptyLabel={isLoading ? "Loading…" : "No compliance actuals recorded yet."}
          columns={[
            { key: "period_date", label: "Date", render: (r) => formatDate(r.period_date) },
            {
              key: "actual_value",
              label: "Actual",
              align: "right",
              render: (r) => r.actual_value ?? "—",
            },
            { key: "met_status", label: "Status", badge: true },
            {
              key: "penalty",
              label: "Penalty",
              render: () =>
                commitment.penalty_applicable ? (commitment.penalty_value ?? "Yes") : "No",
            },
            { key: "recorded_by", label: "Recorded By", render: (r) => userName(r.recorded_by) },
            { key: "created_at", label: "Recorded At", render: (r) => formatDateTime(r.created_at) },
          ]}
        />
      </div>
    </SheetContent>
  );
}
