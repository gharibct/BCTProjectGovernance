"use client";

import * as React from "react";
import { Flag } from "lucide-react";

import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { usePageBanner } from "@/stores/page-banner";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import { Button } from "@/components/ui/button";
import { AiRowSuggestionsPanel, AiRowSuggestionsTrigger } from "@/components/ai/ai-row-suggestions-panel";
import { useNewProjectId } from "@/stores/new-project-ui";
import { useBaselinePeriodId } from "@/lib/period-utils";
import {
  useCreateMilestonePayment,
  useDeleteMilestonePayment,
  useMilestonePayments,
  useUpdateMilestonePayment,
  type MilestonePayment,
  type MilestonePaymentPayload,
} from "@/lib/api/contractual";

const MILESTONE_PREVIEW_FIELDS = [
  { key: "milestone_name", label: "Name" },
  { key: "expected_date_of_payment", label: "Expected Date" },
  { key: "expected_payment_value", label: "Value" },
] as const;

// Shared by the manual "Add Milestone" button and the AI row-suggestions
// panel's Apply (both ultimately call the same createMilestone mutation).
function buildMilestonePayload(values: Record<string, string>): MilestonePaymentPayload {
  return {
    milestone_name: values.milestone_name,
    expected_date_of_payment: values.expected_date_of_payment || undefined,
    expected_payment_value: values.expected_payment_value || undefined,
    milestone_description: values.milestone_description || undefined,
  };
}

// Populate the "New Payment Milestone" form from an existing row for in-place editing.
function toValues(item: MilestonePayment): Record<string, string> {
  return {
    milestone_name: item.milestone_name,
    expected_date_of_payment: item.expected_date_of_payment ?? "",
    expected_payment_value: item.expected_payment_value ?? "",
    milestone_description: item.milestone_description ?? "",
  };
}

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
  const periodId = useBaselinePeriodId();
  const { values, set, reset, load } = useEntryValues();
  const { data: items = [] } = useMilestonePayments(projectId);
  const createMilestone = useCreateMilestonePayment(projectId);
  const updateMilestone = useUpdateMilestonePayment(projectId);
  const deleteMilestone = useDeleteMilestonePayment(projectId);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

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
        showSuccess("Payment Milestone Deleted Successfully");
      },
      onError: (err) =>
        showError(err instanceof Error ? err.message : "Failed to delete payment milestone."),
    });
  };

  const submit = () => {
    if (!values.milestone_name?.trim() || !values.expected_date_of_payment) return;
    const payload = buildMilestonePayload(values);

    if (editingId) {
      updateMilestone.mutate(
        { id: editingId, payload },
        {
          onSuccess: () => {
            cancelEdit();
            showSuccess("Payment Milestone Updated Successfully");
          },
          onError: (err) =>
            showError(err instanceof Error ? err.message : "Failed to update payment milestone."),
        }
      );
    } else {
      createMilestone.mutate(payload, {
        onSuccess: () => {
          reset();
          showSuccess("Payment Milestone Added Successfully");
        },
        onError: (err) =>
          showError(err instanceof Error ? err.message : "Failed to add payment milestone."),
      });
    }
  };

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  const busy = createMilestone.isPending || updateMilestone.isPending;

  return (
    <div className="flex flex-col gap-8">
      <AiRowSuggestionsTrigger
        projectId={projectId}
        screen="milestones"
        periodId={periodId}
        itemLabel="Payment Milestone"
      />

      <SectionCard
        icon={Flag}
        title="Payment Milestones Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterImportToolbar
          defs={MILESTONE_FIELDS}
          itemLabelPlural="Payment Milestones"
          buildPayload={buildMilestonePayload}
          createMutation={createMilestone}
        />
        <RegisterTable
          items={items}
          emptyLabel="No payment milestones defined yet."
          onEdit={startEdit}
          onDelete={handleDelete}
          columns={[
            { key: "milestone_name", label: "Payment Milestone" },
            { key: "expected_date_of_payment", label: "Expected Date" },
            { key: "expected_payment_value", label: "Expected Value", align: "right" },
            { key: "milestone_description", label: "Description" },
          ]}
        />
      </SectionCard>

      <AiRowSuggestionsPanel
        projectId={projectId}
        screen="milestones"
        periodId={periodId}
        itemLabel="Payment Milestone"
        previewFields={MILESTONE_PREVIEW_FIELDS}
        buildPayload={buildMilestonePayload}
        createMutation={createMilestone}
      />

      <SectionCard icon={Flag} title="New Payment Milestone">
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
            {editingId ? "Edit Payment Milestone" : "Add Payment Milestone"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
