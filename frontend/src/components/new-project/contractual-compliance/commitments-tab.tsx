"use client";

import * as React from "react";
import { ClipboardCheck } from "lucide-react";

import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { usePageBanner } from "@/stores/page-banner";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";
import { AiRowSuggestionsPanel, AiRowSuggestionsTrigger } from "@/components/ai/ai-row-suggestions-panel";
import { useNewProjectId } from "@/stores/new-project-ui";
import { useBaselinePeriodId } from "@/lib/period-utils";
import {
  useCommitments,
  useCreateCommitment,
  type CommitmentFrequency,
  type ContractualCommitmentPayload,
} from "@/lib/api/contractual";

const COMMITMENT_PREVIEW_FIELDS = [
  { key: "commitment_name", label: "Name" },
  { key: "frequency", label: "Frequency" },
  { key: "target", label: "Target" },
] as const;

// Shared by the manual "Add Commitment" button and the AI row-suggestions
// panel's Apply (both ultimately call the same createCommitment mutation).
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

export function CommitmentsTab() {
  const projectId = useNewProjectId();
  const periodId = useBaselinePeriodId();
  const { values, set, reset } = useEntryValues();
  const { data: items = [] } = useCommitments(projectId);
  const createCommitment = useCreateCommitment(projectId);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const addCommitment = () => {
    if (!values.commitment_name?.trim() || !values.frequency) return;
    createCommitment.mutate(buildCommitmentPayload(values), {
      onSuccess: () => {
        reset();
        showSuccess("Commitment Added Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to add commitment."),
    });
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
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addCommitment}
            disabled={createCommitment.isPending}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {createCommitment.isPending ? <ButtonSpinner /> : null}
            Add Commitment
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
