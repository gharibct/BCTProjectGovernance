"use client";

import { useParams, useSearchParams } from "next/navigation";
import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { usePageBanner } from "@/stores/page-banner";
import {
  EntryFields,
  useEditableEntry,
  useEntryValues,
  type FieldDef,
} from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import { AiRowSuggestionsPanel, AiRowSuggestionsTrigger } from "@/components/ai/ai-row-suggestions-panel";
import { useUsers } from "@/lib/api/reference-data";
import {
  useAssumptions,
  useCreateAssumption,
  useDeleteAssumption,
  useDependencies,
  useUpdateAssumption,
  type AssumptionLog as AssumptionLogItem,
  type AssumptionLogPayload,
} from "@/lib/api/raid";

// Fields per §4.8 Assumption Log. Keys match AssumptionLogCreate/Update's
// field names — validation_status/current_status/last_updated aren't
// settable here (they default to "Pending"/"Open" server-side).
function useAssumptionFields(projectId: string | null): FieldDef[] {
  const { data: users } = useUsers();
  const { data: dependencies } = useDependencies(projectId);
  const userChoices = (users ?? []).map((u) => ({ value: u.id, label: u.full_name }));
  const dependencyChoices = (dependencies ?? []).map((d) => ({
    value: d.id,
    label: `${d.dependency_code} — ${d.dependency_title}`,
  }));

  return [
    { key: "title", label: "Title", kind: "text", mandatory: true },
    { key: "category", label: "Category", kind: "text" },
    { key: "raised_by", label: "Raised By", kind: "select", choices: userChoices },
    { key: "raised_date", label: "Raised Date", kind: "date" },
    { key: "owner", label: "Owner", kind: "select", choices: userChoices },
    {
      key: "dependency_reference",
      label: "Dependency Reference",
      kind: "select",
      choices: dependencyChoices,
      hint: "Optional link to a Dependency record",
    },
    {
      key: "probability_of_failure",
      label: "Probability of Failure",
      kind: "select",
      options: ["Low", "Medium", "High"],
    },
    {
      key: "impact_rating",
      label: "Impact Rating",
      kind: "select",
      options: ["Low", "Medium", "High", "Critical"],
      mandatory: true,
    },
    { key: "validation_date", label: "Validation Date", kind: "date" },
    { key: "detailed_description", label: "Detailed Description", kind: "textarea" },
    { key: "impact_if_invalid", label: "Impact if Invalid", kind: "textarea" },
    { key: "mitigation_plan", label: "Mitigation Plan", kind: "textarea" },
    { key: "contingency_plan", label: "Contingency Plan", kind: "textarea" },
    { key: "remarks", label: "Remarks", kind: "textarea" },
  ];
}

const ASSUMPTION_PREVIEW_FIELDS = [
  { key: "title", label: "Title" },
  { key: "category", label: "Category" },
  { key: "probability_of_failure", label: "Probability of Failure" },
  { key: "impact_rating", label: "Impact Rating" },
] as const;

function buildAssumptionPayload(values: Record<string, string>): AssumptionLogPayload {
  return values as AssumptionLogPayload;
}

export function AssumptionLog() {
  const { projectId } = useParams<{ projectId: string }>();
  const periodId = useSearchParams().get("period");
  const { values, set, reset, load } = useEntryValues();
  const { data: items = [] } = useAssumptions(projectId);
  const createAssumption = useCreateAssumption(projectId);
  const updateAssumption = useUpdateAssumption(projectId);
  const deleteAssumption = useDeleteAssumption(projectId);
  const fields = useAssumptionFields(projectId);
  const { data: users } = useUsers();
  const userName = (id: string | null) => users?.find((u) => u.id === id)?.full_name ?? "—";
  const { editingId, startEdit, cancelEdit } = useEditableEntry<AssumptionLogItem>(
    load,
    reset,
    (item) => item as unknown as Record<string, string>
  );
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const handleDelete = (item: AssumptionLogItem) => {
    deleteAssumption.mutate(item.id, {
      onSuccess: () => {
        if (editingId === item.id) cancelEdit();
        showSuccess("Assumption Deleted Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete assumption."),
    });
  };

  const submit = () => {
    if (!values.title?.trim()) return;
    const payload = buildAssumptionPayload(values);

    if (editingId) {
      updateAssumption.mutate(
        { id: editingId, payload },
        {
          onSuccess: () => {
            cancelEdit();
            showSuccess("Assumption Updated Successfully");
          },
          onError: (err) => showError(err instanceof Error ? err.message : "Failed to update assumption."),
        }
      );
    } else {
      createAssumption.mutate(payload, {
        onSuccess: () => {
          reset();
          showSuccess("Assumption Added Successfully");
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to add assumption."),
      });
    }
  };

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  const busy = createAssumption.isPending || updateAssumption.isPending;

  return (
    <div className="flex flex-col gap-8">
      <AiRowSuggestionsTrigger
        projectId={projectId}
        screen="assumptions"
        periodId={periodId}
        itemLabel="Assumption"
      />

      <SectionCard
        icon={HelpCircle}
        title="Assumption Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterImportToolbar
          defs={fields}
          itemLabelPlural="Assumptions"
          buildPayload={buildAssumptionPayload}
          createMutation={createAssumption}
        />
        <RegisterTable
          items={items}
          emptyLabel="No assumptions logged yet."
          onEdit={startEdit}
          onDelete={handleDelete}
          columns={[
            { key: "assumption_code", label: "Assumption ID" },
            { key: "title", label: "Title" },
            { key: "category", label: "Category" },
            { key: "owner", label: "Owner", render: (item) => userName(item.owner) },
            { key: "impact_rating", label: "Impact", badge: true },
            { key: "current_status", label: "Status", badge: true },
          ]}
        />
      </SectionCard>

      <AiRowSuggestionsPanel
        projectId={projectId}
        screen="assumptions"
        periodId={periodId}
        itemLabel="Assumption"
        previewFields={ASSUMPTION_PREVIEW_FIELDS}
        buildPayload={buildAssumptionPayload}
        createMutation={createAssumption}
        updateMutation={updateAssumption}
      />

      <SectionCard icon={HelpCircle} title="New Assumption">
        <EntryFields defs={fields} values={values} set={set} />
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
            {editingId ? "Edit Assumption" : "Add Assumption"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
