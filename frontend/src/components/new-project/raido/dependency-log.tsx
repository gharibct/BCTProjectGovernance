"use client";

import * as React from "react";
import { Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
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
import {
  useCreateDependency,
  useDependencies,
  useUpdateDependency,
  type DependencyLog as DependencyLogItem,
  type DependencyLogPayload,
} from "@/lib/api/raid";

const DEPENDENCY_PREVIEW_FIELDS = [
  { key: "dependency_title", label: "Title" },
  { key: "category", label: "Category" },
  { key: "criticality", label: "Criticality" },
  { key: "probability_of_delay", label: "Probability of Delay" },
] as const;

// Shared by the manual "Add Dependency" button and the AI row-suggestions
// panel's Apply (both ultimately call the same createDependency mutation).
function buildDependencyPayload(values: Record<string, string>): DependencyLogPayload {
  return {
    ...values,
    escalation_required: values.escalation_required === "Y",
  };
}

// Fields per §4.7 Dependency Log. Keys match DependencyLogCreate's field
// names — dependency_status/last_updated/actual_completion_date aren't
// settable at creation (status defaults to "Not Started" server-side).
function useDependencyFields(): FieldDef[] {
  const { data: users } = useUsers();
  const userChoices = (users ?? []).map((u) => ({ value: u.id, label: u.full_name }));

  return [
    { key: "dependency_title", label: "Dependency Title", kind: "text", mandatory: true },
    {
      key: "dependency_type",
      label: "Dependency Type",
      kind: "select",
      options: [
        "Internal",
        "External",
        "Vendor",
        "Customer",
        "Infrastructure",
        "Regulatory",
        "Third Party",
      ],
    },
    { key: "category", label: "Category", kind: "text" },
    { key: "depends_on", label: "Depends On", kind: "text" },
    { key: "related_task_milestone", label: "Related Task / Milestone", kind: "text" },
    { key: "required_by_date", label: "Required By", kind: "date" },
    { key: "owner", label: "Owner", kind: "select", choices: userChoices },
    {
      key: "criticality",
      label: "Criticality",
      kind: "select",
      options: ["Low", "Medium", "High", "Critical"],
      mandatory: true,
    },
    {
      key: "probability_of_delay",
      label: "Probability of Delay",
      kind: "select",
      options: ["Low", "Medium", "High"],
    },
    {
      key: "escalation_required",
      label: "Escalation Required",
      kind: "select",
      options: ["Y", "N"],
    },
    {
      key: "escalation_level",
      label: "Escalation Level",
      kind: "select",
      options: ["Project Manager", "Delivery Manager", "Steering Committee"],
    },
    { key: "last_review_date", label: "Last Review Date", kind: "date" },
    { key: "next_review_date", label: "Next Review Date", kind: "date" },
    { key: "description", label: "Description", kind: "textarea" },
    { key: "impact_if_delayed", label: "Impact if Delayed", kind: "textarea" },
    { key: "mitigation_plan", label: "Mitigation Plan", kind: "textarea" },
    { key: "remarks", label: "Remarks", kind: "textarea" },
  ];
}

export function DependencyLog() {
  const projectId = useNewProjectId();
  const periodId = useBaselinePeriodId();
  const { values, set, reset } = useEntryValues();
  const { data: items = [] } = useDependencies(projectId);
  const createDependency = useCreateDependency(projectId);
  const updateDependency = useUpdateDependency(projectId);
  const fields = useDependencyFields();
  const { data: users } = useUsers();
  const userName = (id: string | null) => users?.find((u) => u.id === id)?.full_name ?? "—";
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const addDependency = () => {
    if (!values.dependency_title?.trim()) return;
    createDependency.mutate(buildDependencyPayload(values), {
      onSuccess: () => {
        reset();
        showSuccess("Dependency Added Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to add dependency."),
    });
  };

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <AiRowSuggestionsTrigger
        projectId={projectId}
        screen="dependencies"
        periodId={periodId}
        itemLabel="Dependency"
      />

      <SectionCard
        icon={Link2}
        title="Dependency Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterImportToolbar
          defs={fields}
          itemLabelPlural="Dependencies"
          buildPayload={buildDependencyPayload}
          createMutation={createDependency}
        />
        <RegisterTable
          items={items}
          emptyLabel="No dependencies logged yet."
          columns={[
            { key: "dependency_code", label: "Dependency ID" },
            { key: "dependency_title", label: "Title" },
            { key: "category", label: "Category" },
            { key: "owner", label: "Owner", render: (item: DependencyLogItem) => userName(item.owner) },
            { key: "criticality", label: "Criticality", badge: true },
            { key: "dependency_status", label: "Status", badge: true },
          ]}
        />
      </SectionCard>

      <AiRowSuggestionsPanel
        projectId={projectId}
        screen="dependencies"
        periodId={periodId}
        itemLabel="Dependency"
        previewFields={DEPENDENCY_PREVIEW_FIELDS}
        buildPayload={buildDependencyPayload}
        createMutation={createDependency}
        updateMutation={updateDependency}
      />

      <SectionCard icon={Link2} title="New Dependency">
        <EntryFields defs={fields} values={values} set={set} />
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addDependency}
            disabled={createDependency.isPending}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {createDependency.isPending ? <ButtonSpinner /> : null}
            Add Dependency
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
