"use client";

import * as React from "react";
import { toast } from "sonner";
import { Flag } from "lucide-react";

import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";
import { useNewProjectId } from "@/stores/new-project-ui";
import { useCreateMilestonePayment, useMilestonePayments } from "@/lib/api/contractual";

// Per §4.11 Milestones Linked to Payment — Definition fields, matching
// MilestonePaymentCreate. Payment Actuals/Status are recorded later, once
// each milestone is actually due, via a separate endpoint/screen.
const MILESTONE_FIELDS: FieldDef[] = [
  { key: "milestone_name", label: "Milestone Name", kind: "text", mandatory: true },
  {
    key: "expected_date_of_payment",
    label: "Expected Date of Payment",
    kind: "date",
    mandatory: true,
  },
  { key: "expected_payment_value", label: "Expected Payment Value", kind: "number" },
  { key: "milestone_description", label: "Milestone Description", kind: "textarea" },
];

export function MilestonesTab() {
  const projectId = useNewProjectId();
  const { values, set, reset } = useEntryValues();
  const { data: items = [] } = useMilestonePayments(projectId);
  const createMilestone = useCreateMilestonePayment(projectId);

  const addMilestone = () => {
    if (!values.milestone_name?.trim() || !values.expected_date_of_payment) return;
    createMilestone.mutate(
      {
        milestone_name: values.milestone_name,
        expected_date_of_payment: values.expected_date_of_payment,
        expected_payment_value: values.expected_payment_value || undefined,
        milestone_description: values.milestone_description || undefined,
      },
      {
        onSuccess: () => {
          reset();
          toast.success("Milestone Added Successfully");
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to add milestone."),
      }
    );
  };

  if (!projectId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Create the project on the Project Profile tab first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        icon={Flag}
        title="Milestones Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No milestones defined yet."
          columns={[
            { key: "milestone_name", label: "Milestone" },
            { key: "expected_date_of_payment", label: "Expected Date" },
            { key: "expected_payment_value", label: "Expected Value", align: "right" },
            { key: "milestone_description", label: "Description" },
          ]}
        />
      </SectionCard>

      <SectionCard icon={Flag} title="New Milestone">
        <EntryFields defs={MILESTONE_FIELDS} values={values} set={set} />
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addMilestone}
            disabled={createMilestone.isPending}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {createMilestone.isPending ? <ButtonSpinner /> : null}
            Add Milestone
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
