"use client";

import { useParams } from "next/navigation";
import { Flag, GaugeCircle } from "lucide-react";
import * as React from "react";

import { AutoBadge, ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { usePageBanner } from "@/stores/page-banner";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  useMilestoneActuals,
  useMilestonePayments,
  useUpsertMilestoneActual,
  type MilestonePayment,
  type MilestonePaymentActual,
  type MilestonePaymentStatus,
} from "@/lib/api/contractual";

const MILESTONE_STATUSES: MilestonePaymentStatus[] = [
  "Paid On Time",
  "Delayed Payment",
  "Yet To Be Paid",
];

// Project Reporting is actuals-only: the milestone definitions are fixed at
// charter time (New Project → Contractual Compliance). This tab shows the
// register read-only and lets the PM record the actual payment as it happens.
export function MilestonesTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: items = [] } = useMilestonePayments(projectId);
  const milestoneIds = React.useMemo(() => items.map((i) => i.id), [items]);
  const actualsByMilestone = useMilestoneActuals(projectId, milestoneIds);

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        icon={Flag}
        title="Payment Milestones Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No payment milestones defined yet."
          columns={[
            { key: "milestone_name", label: "Payment Milestone" },
            { key: "expected_date_of_payment", label: "Expected Date" },
            { key: "expected_payment_value", label: "Expected Value", align: "right" },
            {
              key: "actual_date_of_payment",
              label: "Actual Date",
              render: (item) => actualsByMilestone[item.id]?.actual_date_of_payment ?? "—",
            },
            {
              key: "actual_payment_value",
              label: "Actual Value",
              align: "right",
              render: (item) => actualsByMilestone[item.id]?.actual_payment_value ?? "—",
            },
            {
              key: "status",
              label: "Status",
              render: (item) => actualsByMilestone[item.id]?.status ?? "—",
            },
            {
              key: "remarks",
              label: "Remarks",
              render: (item) => actualsByMilestone[item.id]?.remarks ?? "—",
            },
          ]}
        />
      </SectionCard>

      <PaymentActualCapture projectId={projectId} milestones={items} actualsByMilestone={actualsByMilestone} />
    </div>
  );
}

// Monthly Project Reporting capture: the milestone definitions above are set
// at charter time; here the PM records the actual payment as it happens (one
// actual per milestone — the server upserts it).
function PaymentActualCapture({
  projectId,
  milestones,
  actualsByMilestone,
}: {
  projectId: string;
  milestones: MilestonePayment[];
  actualsByMilestone: Record<string, MilestonePaymentActual | null>;
}) {
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const [milestoneId, setMilestoneId] = React.useState("");
  const [actualDate, setActualDate] = React.useState("");
  const [actualValue, setActualValue] = React.useState("");
  const [statusValue, setStatusValue] = React.useState<"" | MilestonePaymentStatus>("");
  const [remarks, setRemarks] = React.useState("");

  const upsertActual = useUpsertMilestoneActual(projectId, milestoneId);

  // Prefill from any actual already recorded for the picked milestone.
  const selectMilestone = (id: string) => {
    setMilestoneId(id);
    const existing = id ? actualsByMilestone[id] : null;
    setActualDate(existing?.actual_date_of_payment ?? "");
    setActualValue(existing?.actual_payment_value ?? "");
    setStatusValue(existing?.status ?? "");
    setRemarks(existing?.remarks ?? "");
  };

  const save = () => {
    if (!milestoneId) return;
    upsertActual.mutate(
      {
        actual_date_of_payment: actualDate || undefined,
        actual_payment_value: actualValue || undefined,
        status: statusValue || undefined,
        remarks: remarks || undefined,
      },
      {
        onSuccess: () => showSuccess("Payment Actual Saved"),
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to save the payment actual."),
      },
    );
  };

  return (
    <SectionCard icon={GaugeCircle} title="Record Payment Actual">
      {milestones.length === 0 ? (
        <EmptyState>No payment milestones have been defined for this project.</EmptyState>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Payment Milestone">
              <NativeSelect value={milestoneId} onChange={(e) => selectMilestone(e.target.value)}>
                <option value="" disabled>
                  Select…
                </option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.milestone_name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Status">
              <NativeSelect
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value as "" | MilestonePaymentStatus)}
              >
                <option value="">—</option>
                {MILESTONE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Actual Date of Payment">
              <Input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} />
            </Field>
            <Field label="Actual Payment Value">
              <Input
                type="number"
                value={actualValue}
                onChange={(e) => setActualValue(e.target.value)}
                placeholder="e.g. 50000"
              />
            </Field>
            <Field label="Remarks" className="sm:col-span-2">
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
            </Field>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              onClick={save}
              disabled={!milestoneId || upsertActual.isPending}
              className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            >
              {upsertActual.isPending ? <ButtonSpinner /> : null}
              Save Payment Actual
            </Button>
          </div>
        </>
      )}
    </SectionCard>
  );
}
