"use client";

import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import * as React from "react";

import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import {
  EntryFields,
  useEntryValues,
  type FieldDef,
} from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";
import {
  useCreateMilestonePayment,
  useDeleteMilestonePayment,
  useMilestonePayments,
  useUpdateMilestonePayment,
  type MilestonePayment,
  type MilestonePaymentPayload,
} from "@/lib/api/contractual";

// Definition fields only (per MilestonePaymentCreate/Update) — Actual
// Date/Value/Status are their own upsert sub-resource, recorded later once
// each milestone is actually due, same split New Project's version documents.
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

function toValues(item: MilestonePayment): Record<string, string> {
  return {
    milestone_name: item.milestone_name,
    expected_date_of_payment: item.expected_date_of_payment ?? "",
    expected_payment_value: item.expected_payment_value ?? "",
    milestone_description: item.milestone_description ?? "",
  };
}

export function MilestonesTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const { values, set, reset, load } = useEntryValues();
  const { data: items = [] } = useMilestonePayments(projectId);
  const createMilestone = useCreateMilestonePayment(projectId);
  const updateMilestone = useUpdateMilestonePayment(projectId);
  const deleteMilestone = useDeleteMilestonePayment(projectId);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const startEdit = (item: MilestonePayment) => {
    setEditingId(item.id);
    load(toValues(item));
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
  };

  const handleDelete = (item: MilestonePayment) => {
    deleteMilestone.mutate(item.id, {
      onSuccess: () => {
        if (editingId === item.id) cancelEdit();
        toast.success("Milestone Deleted Successfully");
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete milestone."),
    });
  };

  const submit = () => {
    if (!values.milestone_name?.trim() || !values.expected_date_of_payment) return;
    const payload: MilestonePaymentPayload = {
      milestone_name: values.milestone_name,
      expected_date_of_payment: values.expected_date_of_payment,
      expected_payment_value: values.expected_payment_value || undefined,
      milestone_description: values.milestone_description || undefined,
    };

    if (editingId) {
      updateMilestone.mutate(
        { id: editingId, payload },
        {
          onSuccess: () => {
            cancelEdit();
            toast.success("Milestone Updated Successfully");
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update milestone."),
        }
      );
    } else {
      createMilestone.mutate(payload, {
        onSuccess: () => {
          reset();
          toast.success("Milestone Added Successfully");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add milestone."),
      });
    }
  };

  if (!projectId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Create the project on the Project Profile tab first.
      </p>
    );
  }

  const busy = createMilestone.isPending || updateMilestone.isPending;

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
          onEdit={startEdit}
          onDelete={handleDelete}
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
        <div className="mt-6 flex justify-end gap-3">
          {editingId ? (
            <Button variant="outline" className="h-11 px-6 text-sm font-semibold" onClick={cancelEdit}>
              Cancel
            </Button>
          ) : null}
          <Button
            onClick={submit}
            disabled={busy}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {busy ? <ButtonSpinner /> : null}
            {editingId ? "Edit Milestone" : "Add Milestone"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
