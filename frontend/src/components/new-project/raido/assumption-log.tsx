"use client";

import * as React from "react";
import { HelpCircle, Plus } from "lucide-react";

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
import { useNewProjectId } from "@/stores/new-project-ui";
import { useProjectPeopleChoices, useUsersByIds } from "@/lib/api/reference-data";
import { useDependencies } from "@/lib/api/raid";
import {
  useAssumptions,
  useCreateAssumption,
  type AssumptionLog as AssumptionLogItem,
  type AssumptionLogPayload,
} from "@/lib/api/raid";

function buildAssumptionPayload(values: Record<string, string>): AssumptionLogPayload {
  return values as AssumptionLogPayload;
}

// Fields per §4.8 Assumption Log. Keys match AssumptionLogCreate's field
// names — validation_status/current_status/last_updated aren't settable at
// creation (they default to "Pending"/"Open" server-side).
function useAssumptionFields(): FieldDef[] {
  const projectId = useNewProjectId();
  const userChoices = useProjectPeopleChoices(projectId);
  const { data: dependencies } = useDependencies(projectId);
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
  const { values, set, reset } = useEntryValues();
  const { data: items = [] } = useAssumptions(projectId);
  const createAssumption = useCreateAssumption(projectId);
  const fields = useAssumptionFields();
  const { data: users } = useUsersByIds(items.map((item) => item.owner));
  const userName = (id: string | null) => users?.find((u) => u.id === id)?.full_name ?? "—";
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const [formOpen, setFormOpen] = React.useState(false);
  const startAdd = () => {
    reset();
    setFormOpen(true);
  };
  const cancelForm = () => {
    reset();
    setFormOpen(false);
  };
  const formRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (formOpen) formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [formOpen]);

  const addAssumption = () => {
    if (!values.title?.trim()) return;
    createAssumption.mutate(buildAssumptionPayload(values), {
      onSuccess: () => {
        reset();
        setFormOpen(false);
        showSuccess("Assumption Added Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to add assumption."),
    });
  };

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">

      <SectionCard
        icon={HelpCircle}
        title="Assumption Register"
        aside={
          <div className="flex items-center gap-3">
            <AutoBadge label={`${items.length} logged`} />
            <Button
              onClick={startAdd}
              className="h-9 gap-1.5 bg-[#1a4a7a] px-4 text-sm font-semibold text-white hover:bg-[#15406b]"
            >
              <Plus className="size-4" />
              Add Assumption
            </Button>
          </div>
        }
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


      {formOpen ? (
        <div ref={formRef}>
          <SectionCard icon={HelpCircle} title="New Assumption">
            <EntryFields defs={fields} values={values} set={set} />
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" className="h-11 px-6 text-sm font-semibold" onClick={cancelForm}>
                Cancel
              </Button>
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
      ) : null}
    </div>
  );
}
