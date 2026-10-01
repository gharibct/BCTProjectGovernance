"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Flag, Pencil } from "lucide-react";
import * as React from "react";

import { AutoBadge, ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { ReviewedNoChangesButton } from "@/components/reporting/reviewed-no-changes-button";
import { usePageBanner } from "@/stores/page-banner";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  const periodId = useSearchParams().get("period");
  const { data: items = [] } = useMilestonePayments(projectId);
  const milestoneIds = React.useMemo(() => items.map((i) => i.id), [items]);
  const actualsByMilestone = useMilestoneActuals(projectId, milestoneIds);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <ReviewedNoChangesButton projectId={projectId} periodId={periodId} pageType="PAYMENT_MILESTONES" />
      </div>
      <SectionCard
        icon={Flag}
        title="Payment Milestones Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No payment milestones defined yet."
          onRowClick={(item) => setSelectedId(item.id)}
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
            {
              key: "record",
              label: "",
              align: "right",
              render: (item) => (
                <Button
                  className="h-8 gap-1.5 bg-[#1a4a7a] px-3 text-xs font-semibold text-white hover:bg-[#15406b]"
                  aria-label={`Record payment actual for ${item.milestone_name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(item.id);
                  }}
                >
                  <Pencil className="size-3.5" />
                  Record Actual
                </Button>
              ),
            },
          ]}
        />
      </SectionCard>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        {selected ? (
          <PaymentActualDrawer
            key={selected.id}
            projectId={projectId}
            milestone={selected}
            actual={actualsByMilestone[selected.id]}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </Sheet>
    </div>
  );
}

// Monthly Project Reporting capture: the milestone definitions above are set
// at charter time; here the PM records the actual payment as it happens (one
// actual per milestone — the server upserts it) in a right-hand drawer opened
// from the register row.
function PaymentActualDrawer({
  projectId,
  milestone,
  actual,
  onClose,
}: {
  projectId: string;
  milestone: MilestonePayment;
  actual: MilestonePaymentActual | null | undefined;
  onClose: () => void;
}) {
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const [actualDate, setActualDate] = React.useState(actual?.actual_date_of_payment ?? "");
  const [actualValue, setActualValue] = React.useState(actual?.actual_payment_value ?? "");
  const [statusValue, setStatusValue] = React.useState<"" | MilestonePaymentStatus>(actual?.status ?? "");
  const [remarks, setRemarks] = React.useState(actual?.remarks ?? "");

  const upsertActual = useUpsertMilestoneActual(projectId, milestone.id);

  const save = () => {
    upsertActual.mutate(
      {
        actual_date_of_payment: actualDate || undefined,
        actual_payment_value: actualValue || undefined,
        status: statusValue || undefined,
        remarks: remarks || undefined,
      },
      {
        onSuccess: () => {
          showSuccess("Payment Actual Saved");
          onClose();
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to save the payment actual."),
      },
    );
  };

  return (
    <SheetContent className="gap-0 p-0">
      <SheetHeader>
        <SheetTitle>{milestone.milestone_name}</SheetTitle>
        <SheetDescription>
          Record payment actual · Expected {milestone.expected_date_of_payment ?? "—"}
          {milestone.expected_payment_value ? ` · ${milestone.expected_payment_value}` : ""}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Field label="Status" className="col-span-2">
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
          <Field label="Remarks" className="col-span-2">
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
          </Field>
        </div>
      </div>

      <SheetFooter className="flex-row justify-end gap-3 border-t border-slate-200 p-4">
        <Button variant="outline" className="h-10 px-5 text-sm font-semibold" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={save}
          disabled={upsertActual.isPending}
          className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
        >
          {upsertActual.isPending ? <ButtonSpinner /> : null}
          Save Payment Actual
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}
