"use client";

import * as React from "react";
import { TriangleAlert, Plus } from "lucide-react";

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
import {
  useCreateIssue,
  useIssues,
  type IssueLog as IssueLogItem,
  type IssueLogPayload,
} from "@/lib/api/raid";
import { ACCOUNT_MANAGER_LABEL } from "@/lib/role-labels";

function buildIssuePayload(values: Record<string, string>): IssueLogPayload {
  return values as IssueLogPayload;
}

// Fields per §4.6 Issue Log. Keys match IssueLogCreate's field names —
// fields only settable after creation (status, actual_resolution_date,
// escalation_date, resolution_summary, lessons_learned, closure_date)
// aren't collected here; they belong to a future edit screen.
function useIssueFields(): FieldDef[] {
  const userChoices = useProjectPeopleChoices(useNewProjectId());

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
      options: ["PM", ACCOUNT_MANAGER_LABEL, "Steering Committee"],
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

export function IssueLog() {
  const projectId = useNewProjectId();
  const { values, set, reset } = useEntryValues();
  const { data: items = [] } = useIssues(projectId);
  const createIssue = useCreateIssue(projectId);
  const fields = useIssueFields();
  const { data: users } = useUsersByIds(items.map((item) => item.assigned_to));
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

  const addIssue = () => {
    if (!values.issue_title?.trim()) return;
    createIssue.mutate(buildIssuePayload(values), {
      onSuccess: () => {
        reset();
        setFormOpen(false);
        showSuccess("Issue Added Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to add issue."),
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
        icon={TriangleAlert}
        title="Issue Register"
        aside={
          <div className="flex items-center gap-3">
            <AutoBadge label={`${items.length} logged`} />
            <Button
              onClick={startAdd}
              className="h-9 gap-1.5 bg-[#1a4a7a] px-4 text-sm font-semibold text-white hover:bg-[#15406b]"
            >
              <Plus className="size-4" />
              Add Issue
            </Button>
          </div>
        }
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
          columns={[
            { key: "issue_code", label: "Issue ID" },
            { key: "issue_title", label: "Title" },
            { key: "issue_category", label: "Category" },
            { key: "assigned_to", label: "Owner", render: (item: IssueLogItem) => userName(item.assigned_to) },
            { key: "priority", label: "Priority", badge: true },
            { key: "status", label: "Status", badge: true },
          ]}
        />
      </SectionCard>


      {formOpen ? (
        <div ref={formRef}>
          <SectionCard icon={TriangleAlert} title="New Issue">
            <EntryFields defs={fields} values={values} set={set} />
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" className="h-11 px-6 text-sm font-semibold" onClick={cancelForm}>
                Cancel
              </Button>
              <Button
                onClick={addIssue}
                disabled={createIssue.isPending}
                className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
              >
                {createIssue.isPending ? <ButtonSpinner /> : null}
                Add Issue
              </Button>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
