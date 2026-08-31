"use client";

import { useParams, useSearchParams } from "next/navigation";
import { TrendingUp } from "lucide-react";

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
  useCreateOpportunity,
  useDeleteOpportunity,
  useOpportunities,
  useUpdateOpportunity,
  type OpportunityLog as OpportunityLogItem,
  type OpportunityLogPayload,
} from "@/lib/api/raid";

// Fields per §4.9 Opportunity Log. Keys match OpportunityLogCreate/Update's
// field names — status/approved_by/actual_benefit/closure_date aren't
// settable here (status defaults to "Identified" server-side).
function useOpportunityFields(): FieldDef[] {
  const { data: users } = useUsers();
  const userChoices = (users ?? []).map((u) => ({ value: u.id, label: u.full_name }));

  return [
    { key: "opportunity_title", label: "Opportunity Title", kind: "text", mandatory: true },
    { key: "category", label: "Category", kind: "text" },
    { key: "identified_by", label: "Identified By", kind: "select", choices: userChoices },
    { key: "identified_date", label: "Identified Date", kind: "date" },
    { key: "opportunity_owner", label: "Opportunity Owner", kind: "select", choices: userChoices },
    {
      key: "impact",
      label: "Impact",
      kind: "select",
      options: ["Very Low", "Low", "Medium", "High"],
      mandatory: true,
    },
    {
      key: "expected_benefit",
      label: "Expected Benefit",
      kind: "select",
      options: ["Time", "Cost", "Quality", "Revenue"],
    },
    { key: "estimated_benefit", label: "Estimated Benefit", kind: "number", hint: "Quantified value" },
    {
      key: "benefit_type",
      label: "Benefit Type",
      kind: "select",
      options: ["Cost Saving", "Revenue Increase", "Quality Improvement", "Customer Satisfaction"],
    },
    {
      key: "exploitation_strategy",
      label: "Exploitation Strategy",
      kind: "select",
      options: ["Exploit", "Enhance", "Share", "Accept"],
    },
    { key: "target_implementation_date", label: "Target Implementation Date", kind: "date" },
    { key: "approval_required", label: "Approval Required", kind: "select", options: ["Y", "N"] },
    { key: "last_review_date", label: "Last Review Date", kind: "date" },
    { key: "next_review_date", label: "Next Review Date", kind: "date" },
    { key: "opportunity_description", label: "Opportunity Description", kind: "textarea" },
    { key: "action_plan", label: "Action Plan", kind: "textarea" },
    { key: "remarks", label: "Remarks", kind: "textarea" },
  ];
}

function toValues(item: OpportunityLogItem): Record<string, string> {
  return {
    ...item,
    approval_required: item.approval_required ? "Y" : "N",
  } as unknown as Record<string, string>;
}

const OPPORTUNITY_PREVIEW_FIELDS = [
  { key: "opportunity_title", label: "Title" },
  { key: "category", label: "Category" },
  { key: "impact", label: "Impact" },
  { key: "expected_benefit", label: "Expected Benefit" },
] as const;

function buildOpportunityPayload(values: Record<string, string>): OpportunityLogPayload {
  return {
    ...values,
    approval_required: values.approval_required === "Y",
  };
}

export function OpportunityLog() {
  const { projectId } = useParams<{ projectId: string }>();
  const periodId = useSearchParams().get("period");
  const { values, set, reset, load } = useEntryValues();
  const { data: items = [] } = useOpportunities(projectId);
  const createOpportunity = useCreateOpportunity(projectId);
  const updateOpportunity = useUpdateOpportunity(projectId);
  const deleteOpportunity = useDeleteOpportunity(projectId);
  const fields = useOpportunityFields();
  const { data: users } = useUsers();
  const userName = (id: string | null) => users?.find((u) => u.id === id)?.full_name ?? "—";
  const { editingId, startEdit, cancelEdit } = useEditableEntry<OpportunityLogItem>(load, reset, toValues);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const handleDelete = (item: OpportunityLogItem) => {
    deleteOpportunity.mutate(item.id, {
      onSuccess: () => {
        if (editingId === item.id) cancelEdit();
        showSuccess("Opportunity Deleted Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete opportunity."),
    });
  };

  const submit = () => {
    if (!values.opportunity_title?.trim()) return;
    const payload = buildOpportunityPayload(values);

    if (editingId) {
      updateOpportunity.mutate(
        { id: editingId, payload },
        {
          onSuccess: () => {
            cancelEdit();
            showSuccess("Opportunity Updated Successfully");
          },
          onError: (err) => showError(err instanceof Error ? err.message : "Failed to update opportunity."),
        }
      );
    } else {
      createOpportunity.mutate(payload, {
        onSuccess: () => {
          reset();
          showSuccess("Opportunity Added Successfully");
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to add opportunity."),
      });
    }
  };

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  const busy = createOpportunity.isPending || updateOpportunity.isPending;

  return (
    <div className="flex flex-col gap-8">
      <AiRowSuggestionsTrigger
        projectId={projectId}
        screen="opportunities"
        periodId={periodId}
        itemLabel="Opportunity"
      />

      <SectionCard
        icon={TrendingUp}
        title="Opportunity Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterImportToolbar
          defs={fields}
          itemLabelPlural="Opportunities"
          buildPayload={buildOpportunityPayload}
          createMutation={createOpportunity}
        />
        <RegisterTable
          items={items}
          emptyLabel="No opportunities logged yet."
          onEdit={startEdit}
          onDelete={handleDelete}
          columns={[
            { key: "opportunity_code", label: "Opportunity ID" },
            { key: "opportunity_title", label: "Title" },
            { key: "category", label: "Category" },
            {
              key: "opportunity_owner",
              label: "Owner",
              render: (item) => userName(item.opportunity_owner),
            },
            { key: "impact", label: "Impact", badge: true },
            { key: "status", label: "Status", badge: true },
          ]}
        />
      </SectionCard>

      <AiRowSuggestionsPanel
        projectId={projectId}
        screen="opportunities"
        periodId={periodId}
        itemLabel="Opportunity"
        previewFields={OPPORTUNITY_PREVIEW_FIELDS}
        buildPayload={buildOpportunityPayload}
        createMutation={createOpportunity}
        updateMutation={updateOpportunity}
      />

      <SectionCard icon={TrendingUp} title="New Opportunity">
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
            {editingId ? "Edit Opportunity" : "Add Opportunity"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
