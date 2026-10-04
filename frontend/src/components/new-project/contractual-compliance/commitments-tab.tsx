"use client";

import * as React from "react";
import { ClipboardCheck, Plus } from "lucide-react";

import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { usePageBanner } from "@/stores/page-banner";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNewProjectId } from "@/stores/new-project-ui";
import {
  useCommitments,
  useCreateCommitment,
  useDeleteCommitment,
  useUpdateCommitment,
  type CommitmentFrequency,
  type ContractualCommitment,
  type ContractualCommitmentPayload,
} from "@/lib/api/contractual";

// Shared by the manual "Add Commitment" button and the AI row-suggestions
// panel's Apply (both ultimately call the same createCommitment mutation).
function buildCommitmentPayload(values: Record<string, string>): ContractualCommitmentPayload {
  return {
    commitment_name: values.commitment_name,
    frequency: values.frequency as CommitmentFrequency,
    penalty_applicable: values.penalty_applicable === "Yes",
    commitment_details: values.commitment_details || undefined,
  };
}

// Populate the "New Commitment" form from an existing row for in-place editing.
function toValues(item: ContractualCommitment): Record<string, string> {
  return {
    commitment_name: item.commitment_name,
    frequency: item.frequency,
    penalty_applicable: item.penalty_applicable ? "Yes" : "No",
    commitment_details: item.commitment_details ?? "",
  };
}

// Per §4.11 Contractual Commitment — Definition fields. This is the
// definition stage for a project still being created, so only Definition
// fields are captured here (matches ContractualCommitmentCreate) — Actuals
// are recorded later, once due, via a separate endpoint/screen.
const FREQUENCIES = [
  "One Time",
  "Weekly",
  "Fortnight",
  "Monthly",
  "Quarterly",
  "Half Yearly",
  "Phase Wise",
] as const;

const COMMITMENT_FIELDS: FieldDef[] = [
  { key: "commitment_name", label: "Name of the Commitment", kind: "text", mandatory: true, fullWidth: true },
  {
    key: "frequency",
    label: "Frequency",
    kind: "select",
    options: FREQUENCIES,
    mandatory: true,
  },
  {
    key: "penalty_applicable",
    label: "Penalty Applicability",
    kind: "select",
    options: ["Yes", "No"],
    mandatory: true,
  },
  { key: "commitment_details", label: "Commitment Details", kind: "textarea", mandatory: true, fullWidth: true },
];

export function CommitmentsTab() {
  const projectId = useNewProjectId();
  const { values, set, reset, load } = useEntryValues();
  const { data: items = [] } = useCommitments(projectId);
  const createCommitment = useCreateCommitment(projectId);
  const updateCommitment = useUpdateCommitment(projectId);
  const deleteCommitment = useDeleteCommitment(projectId);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  // The add / edit form lives in a right drawer.
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const startAdd = () => {
    setErrors({});
    setEditingId(null);
    reset();
    setDrawerOpen(true);
  };

  const startEdit = (item: ContractualCommitment) => {
    setErrors({});
    setEditingId(item.id);
    load(toValues(item));
    setDrawerOpen(true);
  };

  const cancelEdit = () => {
    setErrors({});
    setEditingId(null);
    reset();
    setDrawerOpen(false);
  };

  const handleDelete = (item: ContractualCommitment) => {
    deleteCommitment.mutate(item.id, {
      onSuccess: () => {
        if (editingId === item.id) cancelEdit();
        showSuccess("Commitment Deleted Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete commitment."),
    });
  };

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!values.commitment_name?.trim()) nextErrors.commitment_name = "Name of the Commitment is required.";
    if (!values.frequency) nextErrors.frequency = "Frequency is required.";
    if (!values.penalty_applicable) nextErrors.penalty_applicable = "Penalty Applicability is required.";
    if (!values.commitment_details?.trim()) nextErrors.commitment_details = "Commitment Details is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const payload = buildCommitmentPayload(values);

    if (editingId) {
      updateCommitment.mutate(
        { id: editingId, payload },
        {
          onSuccess: () => {
            cancelEdit();
            showSuccess("Commitment Updated Successfully");
          },
          onError: (err) => showError(err instanceof Error ? err.message : "Failed to update commitment."),
        }
      );
    } else {
      createCommitment.mutate(payload, {
        onSuccess: () => {
          reset();
          setDrawerOpen(false);
          showSuccess("Commitment Added Successfully");
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to add commitment."),
      });
    }
  };

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  const busy = createCommitment.isPending || updateCommitment.isPending;

  return (
    <div className="flex flex-col gap-8">

      <SectionCard
        icon={ClipboardCheck}
        title="Commitments Register"
        aside={
          <div className="flex items-center gap-3">
            <AutoBadge label={`${items.length} logged`} />
            <Button
              onClick={startAdd}
              className="h-9 gap-1.5 bg-[#1a4a7a] px-4 text-sm font-semibold text-white hover:bg-[#15406b]"
            >
              <Plus className="size-4" />
              Add Commitment
            </Button>
          </div>
        }
      >
        <RegisterImportToolbar
          defs={COMMITMENT_FIELDS}
          itemLabelPlural="Commitments"
          buildPayload={buildCommitmentPayload}
          createMutation={createCommitment}
        />
        <RegisterTable
          items={items}
          emptyLabel="No commitments defined yet."
          onEdit={startEdit}
          onDelete={handleDelete}
          columns={[
            { key: "commitment_name", label: "Commitment" },
            { key: "frequency", label: "Frequency" },
            {
              key: "penalty_applicable",
              label: "Penalty Applicability",
              render: (item) => (item.penalty_applicable ? "Yes" : "No"),
            },
            { key: "commitment_details", label: "Commitment Details" },
          ]}
        />
      </SectionCard>


      <Sheet open={drawerOpen} onOpenChange={(open) => !open && cancelEdit()}>
        <SheetContent className="gap-0 p-0">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit Commitment" : "New Commitment"}</SheetTitle>
            <SheetDescription>Actuals are recorded later in Project Reporting.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <EntryFields defs={COMMITMENT_FIELDS} values={values} set={set} errors={errors} columns={2} />
          </div>
          <SheetFooter className="flex-row justify-end gap-3 border-t border-slate-200 p-4">
            <Button variant="outline" className="h-10 px-5 text-sm font-semibold" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={busy}
              className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
            >
              {busy ? <ButtonSpinner /> : null}
              {editingId ? "Save Commitment" : "Add Commitment"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
