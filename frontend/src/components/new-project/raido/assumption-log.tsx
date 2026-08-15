"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { usePageBanner } from "@/stores/page-banner";
import {
  EntryFields,
  useEntryValues,
  type FieldDef,
} from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import { AiRowSuggestionsPanel, AiRowSuggestionsTrigger } from "@/components/ai/ai-row-suggestions-panel";
import { useNewProjectId } from "@/stores/new-project-ui";
import { useUsers } from "@/lib/api/reference-data";
import { useBaselinePeriodId } from "@/lib/period-utils";
import { useDependencies } from "@/lib/api/raid";
import {
  useAssumptions,
  useCreateAssumption,
  useUpdateAssumption,
  type AssumptionLog as AssumptionLogItem,
  type AssumptionLogPayload,
} from "@/lib/api/raid";

const ASSUMPTION_PREVIEW_FIELDS = [
  { key: "title", label: "Title" },
  { key: "category", label: "Category" },
  { key: "probability_of_failure", label: "Probability of Failure" },
  { key: "impact_rating", label: "Impact Rating" },
] as const;

function buildAssumptionPayload(values: Record<string, string>): AssumptionLogPayload {
  return values as AssumptionLogPayload;
}

// Fields per §4.8 Assumption Log. Keys match AssumptionLogCreate's field
// names — validation_status/current_status/last_updated aren't settable at
// creation (they default to "Pending"/"Open" server-side).
function useAssumptionFields(): FieldDef[] {
  const { data: users } = useUsers();
  const projectId = useNewProjectId();
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

export function AssumptionLog() {
  const projectId = useNewProjectId();
  const periodId = useBaselinePeriodId();
  const { values, set, reset } = useEntryValues();
  const { data: items = [] } = useAssumptions(projectId);
  const createAssumption = useCreateAssumption(projectId);
  const updateAssumption = useUpdateAssumption(projectId);
  const fields = useAssumptionFields();
  const { data: users } = useUsers();
  const userName = (id: string | null) => users?.find((u) => u.id === id)?.full_name ?? "—";
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const addAssumption = () => {
    if (!values.title?.trim()) return;
    createAssumption.mutate(buildAssumptionPayload(values), {
      onSuccess: () => {
        reset();
        showSuccess("Assumption Added Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to add assumption."),
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
          columns={[
            { key: "assumption_code", label: "Assumption ID" },
            { key: "title", label: "Title" },
            { key: "category", label: "Category" },
            { key: "owner", label: "Owner", render: (item: AssumptionLogItem) => userName(item.owner) },
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
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addAssumption}
            disabled={createAssumption.isPending}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {createAssumption.isPending ? <ButtonSpinner /> : null}
            Add Assumption
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
