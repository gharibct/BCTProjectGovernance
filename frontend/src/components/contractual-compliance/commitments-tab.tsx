"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import * as React from "react";

import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { usePageBanner } from "@/stores/page-banner";
import {
  EntryFields,
  useEntryValues,
  type FieldDef,
} from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";
import { AiRowSuggestionsPanel, AiRowSuggestionsTrigger } from "@/components/ai/ai-row-suggestions-panel";
import {
  useCommitments,
  useCreateCommitment,
  useDeleteCommitment,
  useUpdateCommitment,
  type CommitmentFrequency,
  type ContractualCommitment,
  type ContractualCommitmentPayload,
} from "@/lib/api/contractual";

// Definition fields only (per ContractualCommitmentCreate/Update) — Actuals
// are their own period-based history, recorded later via a separate
// endpoint/screen, same split New Project's version already documents.
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
  { key: "commitment_name", label: "Name of the Commitment", kind: "text", mandatory: true },
  {
    key: "frequency",
    label: "Frequency",
    kind: "select",
    options: FREQUENCIES,
    mandatory: true,
  },
  { key: "formula", label: "Formula", kind: "text", placeholder: "e.g. Resolved / Total" },
  { key: "target", label: "Target", kind: "text", placeholder: "e.g. 95%" },
  {
    key: "penalty_applicable",
    label: "Penalty Applicable",
    kind: "select",
    options: ["Y", "N"],
  },
  { key: "penalty_value", label: "Penalty Value", kind: "number" },
];

function toValues(item: ContractualCommitment): Record<string, string> {
  return {
    commitment_name: item.commitment_name,
    frequency: item.frequency,
    formula: item.formula ?? "",
    target: item.target ?? "",
    penalty_applicable: item.penalty_applicable ? "Y" : "N",
    penalty_value: item.penalty_value ?? "",
  };
}

const COMMITMENT_PREVIEW_FIELDS = [
  { key: "commitment_name", label: "Name" },
  { key: "frequency", label: "Frequency" },
  { key: "target", label: "Target" },
] as const;

function buildCommitmentPayload(values: Record<string, string>): ContractualCommitmentPayload {
  return {
    commitment_name: values.commitment_name,
    frequency: values.frequency as CommitmentFrequency,
    formula: values.formula || undefined,
    target: values.target || undefined,
    penalty_applicable: values.penalty_applicable === "Y",
    penalty_value: values.penalty_value || undefined,
  };
}

export function CommitmentsTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const periodId = useSearchParams().get("period");
  const { values, set, reset, load } = useEntryValues();
  const { data: items = [] } = useCommitments(projectId);
  const createCommitment = useCreateCommitment(projectId);
  const updateCommitment = useUpdateCommitment(projectId);
  const deleteCommitment = useDeleteCommitment(projectId);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const startEdit = (item: ContractualCommitment) => {
    setEditingId(item.id);
    load(toValues(item));
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
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
    if (!values.commitment_name?.trim() || !values.frequency) return;
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
          showSuccess("Commitment Added Successfully");
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to add commitment."),
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

  const busy = createCommitment.isPending || updateCommitment.isPending;

  return (
    <div className="flex flex-col gap-8">
      <AiRowSuggestionsTrigger
        projectId={projectId}
        screen="commitments"
        periodId={periodId}
        itemLabel="Commitment"
      />

      <SectionCard
        icon={ClipboardCheck}
        title="Commitments Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No commitments defined yet."
          onEdit={startEdit}
          onDelete={handleDelete}
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

      <AiRowSuggestionsPanel
        projectId={projectId}
        screen="commitments"
        periodId={periodId}
        itemLabel="Commitment"
        previewFields={COMMITMENT_PREVIEW_FIELDS}
        buildPayload={buildCommitmentPayload}
        createMutation={createCommitment}
      />

      <SectionCard icon={ClipboardCheck} title="New Commitment">
        <EntryFields defs={COMMITMENT_FIELDS} values={values} set={set} />
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
            {editingId ? "Edit Commitment" : "Add Commitment"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
