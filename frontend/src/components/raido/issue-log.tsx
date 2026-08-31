"use client";

import { useParams, useSearchParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";

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
  useCreateIssue,
  useDeleteIssue,
  useIssues,
  useUpdateIssue,
  type IssueLog as IssueLogItem,
  type IssueLogPayload,
} from "@/lib/api/raid";

// Fields per §4.6 Issue Log. Keys match IssueLogCreate/Update's field names
// — fields only settable after creation (status, actual_resolution_date,
// escalation_date, resolution_summary, lessons_learned, closure_date)
// aren't collected here; they belong to a future edit screen.
function useIssueFields(): FieldDef[] {
  const { data: users } = useUsers();
  const userChoices = (users ?? []).map((u) => ({ value: u.id, label: u.full_name }));

  return [
    { key: "issue_title", label: "Issue Title", kind: "text", mandatory: true },
    { key: "issue_category", label: "Issue Category", kind: "text" },
    {
      key: "priority",
      label: "Priority",
      kind: "select",
      options: ["Low", "Medium", "High", "Critical"],
      mandatory: true,
    },
    { key: "severity", label: "Severity", kind: "select", options: ["Minor", "Major", "Critical"] },
    { key: "raised_by", label: "Raised By", kind: "select", choices: userChoices },
    { key: "raised_date", label: "Raised Date", kind: "date" },
    { key: "assigned_to", label: "Assigned To", kind: "select", choices: userChoices },
    { key: "affected_deliverables", label: "Affected Deliverables", kind: "text" },
    { key: "affected_milestone", label: "Affected Milestone", kind: "text" },
    { key: "due_date", label: "Due Date", kind: "date" },
    {
      key: "escalation_level",
      label: "Escalation Level",
      kind: "select",
      options: ["PM", "Delivery Manager", "Steering Committee"],
    },
    { key: "last_review_date", label: "Last Review Date", kind: "date" },
    { key: "next_review_date", label: "Next Review Date", kind: "date" },
    { key: "issue_description", label: "Issue Description", kind: "textarea" },
    { key: "root_cause", label: "Root Cause", kind: "textarea" },
    { key: "business_impact", label: "Business Impact", kind: "textarea" },
    { key: "resolution_plan", label: "Resolution Plan", kind: "textarea" },
    { key: "remarks", label: "Remarks", kind: "textarea" },
  ];
}

const ISSUE_PREVIEW_FIELDS = [
  { key: "issue_title", label: "Title" },
  { key: "issue_category", label: "Category" },
  { key: "priority", label: "Priority" },
  { key: "severity", label: "Severity" },
] as const;

function buildIssuePayload(values: Record<string, string>): IssueLogPayload {
  return values as IssueLogPayload;
}

export function IssueLog() {
  const { projectId } = useParams<{ projectId: string }>();
  const periodId = useSearchParams().get("period");
  const { values, set, reset, load } = useEntryValues();
  const { data: items = [] } = useIssues(projectId);
  const createIssue = useCreateIssue(projectId);
  const updateIssue = useUpdateIssue(projectId);
  const deleteIssue = useDeleteIssue(projectId);
  const fields = useIssueFields();
  const { data: users } = useUsers();
  const userName = (id: string | null) => users?.find((u) => u.id === id)?.full_name ?? "—";
  const { editingId, startEdit, cancelEdit } = useEditableEntry<IssueLogItem>(
    load,
    reset,
    (item) => item as unknown as Record<string, string>
  );
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const handleDelete = (item: IssueLogItem) => {
    deleteIssue.mutate(item.id, {
      onSuccess: () => {
        if (editingId === item.id) cancelEdit();
        showSuccess("Issue Deleted Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete issue."),
    });
  };

  const submit = () => {
    if (!values.issue_title?.trim()) return;
    const payload = buildIssuePayload(values);

    if (editingId) {
      updateIssue.mutate(
        { id: editingId, payload },
        {
          onSuccess: () => {
            cancelEdit();
            showSuccess("Issue Updated Successfully");
          },
          onError: (err) => showError(err instanceof Error ? err.message : "Failed to update issue."),
        }
      );
    } else {
      createIssue.mutate(payload, {
        onSuccess: () => {
          reset();
          showSuccess("Issue Added Successfully");
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to add issue."),
      });
    }
  };

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  const busy = createIssue.isPending || updateIssue.isPending;

  return (
    <div className="flex flex-col gap-8">
      <AiRowSuggestionsTrigger projectId={projectId} screen="issues" periodId={periodId} itemLabel="Issue" />

      <SectionCard
        icon={TriangleAlert}
        title="Issue Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterImportToolbar
          defs={fields}
          itemLabelPlural="Issues"
          buildPayload={buildIssuePayload}
          createMutation={createIssue}
        />
        <RegisterTable
          items={items}
          emptyLabel="No issues logged yet."
          onEdit={startEdit}
          onDelete={handleDelete}
          columns={[
            { key: "issue_code", label: "Issue ID" },
            { key: "issue_title", label: "Title" },
            { key: "issue_category", label: "Category" },
            { key: "assigned_to", label: "Owner", render: (item) => userName(item.assigned_to) },
            { key: "priority", label: "Priority", badge: true },
            { key: "status", label: "Status", badge: true },
          ]}
        />
      </SectionCard>

      <AiRowSuggestionsPanel
        projectId={projectId}
        screen="issues"
        periodId={periodId}
        itemLabel="Issue"
        previewFields={ISSUE_PREVIEW_FIELDS}
        buildPayload={buildIssuePayload}
        createMutation={createIssue}
        updateMutation={updateIssue}
      />

      <SectionCard icon={TriangleAlert} title="New Issue">
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
            {editingId ? "Edit Issue" : "Add Issue"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
