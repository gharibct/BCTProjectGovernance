"use client";

import { useParams } from "next/navigation";
import { FileText, Milestone } from "lucide-react";

import { useCommitments, useMilestonePayments } from "@/lib/api/contractual";
import { SectionCard } from "@/components/forms/form-primitives";
import { RegisterTable } from "@/components/forms/register-table";

export function ContractualView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: commitments = [] } = useCommitments(projectId ?? null);
  const { data: milestones = [] } = useMilestonePayments(projectId ?? null);

  return (
    <div className="flex flex-col gap-6">
      <SectionCard icon={FileText} title="Contractual Commitments">
        <RegisterTable
          items={commitments}
          emptyLabel="No commitments recorded."
          columns={[
            { key: "commitment_name", label: "Commitment" },
            { key: "frequency", label: "Frequency" },
            { key: "target", label: "Target", align: "right" },
            {
              key: "penalty_applicable",
              label: "Penalty",
              render: (item) => (item.penalty_applicable ? "Y" : "N"),
            },
            { key: "penalty_value", label: "Penalty Value", align: "right" },
          ]}
        />
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
    </div>
  );
}
