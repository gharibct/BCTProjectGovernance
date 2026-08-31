"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ClipboardCheck, GaugeCircle } from "lucide-react";
import * as React from "react";

import { AutoBadge, ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { usePageBanner } from "@/stores/page-banner";
import {
  EntryFields,
  useEntryValues,
  type FieldDef,
} from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { AiRowSuggestionsPanel, AiRowSuggestionsTrigger } from "@/components/ai/ai-row-suggestions-panel";
import { useReportingPeriods } from "@/lib/api/reference-data";
import {
  useCommitments,
  useCreateCommitment,
  useCreateCommitmentActual,
  useDeleteCommitment,
  useLatestCommitmentActuals,
  useUpdateCommitment,
  type CommitmentFrequency,
  type ContractualCommitment,
  type ContractualCommitmentPayload,
  type MetStatus,
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
  const commitmentIds = React.useMemo(() => items.map((i) => i.id), [items]);
  const actualsByCommitment = useLatestCommitmentActuals(projectId, commitmentIds);
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
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
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
            { key: "target", label: "Target", align: "right" },
            {
              key: "penalty_applicable",
              label: "Penalty",
              render: (item) => (item.penalty_applicable ? "Y" : "N"),
            },
            { key: "penalty_value", label: "Penalty Value", align: "right" },
            {
              key: "actual",
              label: "Actual",
              align: "right",
              render: (item) => actualsByCommitment[item.id]?.actual_value ?? "—",
            },
            {
              key: "met_status",
              label: "Status",
              render: (item) => actualsByCommitment[item.id]?.met_status ?? "—",
            },
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

      <MonthlyActualCapture projectId={projectId} commitments={items} />
    </div>
  );
}

// Monthly Project Reporting capture: the commitment definitions above are
// fixed at charter time; here the PM records what was actually achieved for
// the selected reporting period (period_date = the period's start date).
function MonthlyActualCapture({
  projectId,
  commitments,
}: {
  projectId: string;
  commitments: ContractualCommitment[];
}) {
  const periodId = useSearchParams().get("period");
  const { data: periods = [] } = useReportingPeriods();
  const period = periods.find((p) => p.id === periodId) ?? null;
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const [commitmentId, setCommitmentId] = React.useState("");
  const [actualValue, setActualValue] = React.useState("");
  const [metStatus, setMetStatus] = React.useState<"" | MetStatus>("");

  const createActual = useCreateCommitmentActual(projectId, commitmentId);

  const save = () => {
    if (!commitmentId || !period) return;
    createActual.mutate(
      {
        period_date: period.start_date,
        actual_value: actualValue || undefined,
        met_status: metStatus || undefined,
      },
      {
        onSuccess: () => {
          setActualValue("");
          setMetStatus("");
          showSuccess("Commitment Actual Recorded");
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to record the actual."),
      },
    );
  };

  return (
    <SectionCard icon={GaugeCircle} title="Record Monthly Actual">
      {commitments.length === 0 ? (
        <EmptyState>Define a commitment above before recording an actual.</EmptyState>
      ) : !period ? (
        <EmptyState>Open this screen for a reporting period to record actuals.</EmptyState>
      ) : (
        <>
          <p className="mb-6 text-sm text-slate-500">
            Reporting period: <span className="font-semibold text-slate-700">{period.label}</span>
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            <Field label="Commitment">
              <NativeSelect value={commitmentId} onChange={(e) => setCommitmentId(e.target.value)}>
                <option value="" disabled>
                  Select…
                </option>
                {commitments.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.commitment_name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Actual">
              <Input
                value={actualValue}
                onChange={(e) => setActualValue(e.target.value)}
                placeholder="e.g. 93%"
              />
            </Field>
            <Field label="Status">
              <NativeSelect
                value={metStatus}
                onChange={(e) => setMetStatus(e.target.value as "" | MetStatus)}
              >
                <option value="">—</option>
                <option value="Met">Met</option>
                <option value="Not Met">Not Met</option>
                <option value="Breached">Breached</option>
              </NativeSelect>
            </Field>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              onClick={save}
              disabled={!commitmentId || createActual.isPending}
              className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            >
              {createActual.isPending ? <ButtonSpinner /> : null}
              Record Actual
            </Button>
          </div>
        </>
      )}
    </SectionCard>
  );
}
