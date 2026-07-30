"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
import {
  EntryFields,
  useEntryValues,
  useIdCounter,
  type FieldDef,
} from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";

// Fields per §4.6 Issue Log, including the proposed Last/Next Review Date
// addition for parity with the Risk Log's monthly-review cadence.
const ISSUE_FIELDS: FieldDef[] = [
  { key: "title", label: "Issue Title", kind: "text", mandatory: true },
  { key: "category", label: "Issue Category", kind: "text" },
  {
    key: "priority",
    label: "Priority",
    kind: "select",
    options: ["Low", "Medium", "High", "Critical"],
    mandatory: true,
  },
  {
    key: "severity",
    label: "Severity",
    kind: "select",
    options: ["Minor", "Major", "Critical"],
  },
  { key: "raisedBy", label: "Raised By", kind: "text" },
  { key: "raisedDate", label: "Raised Date", kind: "date" },
  { key: "assignedTo", label: "Assigned To", kind: "text" },
  { key: "affectedDeliverables", label: "Affected Deliverables", kind: "text" },
  { key: "affectedMilestone", label: "Affected Milestone", kind: "text" },
  { key: "dueDate", label: "Due Date", kind: "date" },
  {
    key: "status",
    label: "Status",
    kind: "select",
    options: ["New", "Assigned", "In Progress", "Pending", "Resolved", "Closed"],
  },
  {
    key: "escalationLevel",
    label: "Escalation Level",
    kind: "select",
    options: ["PM", "Delivery Manager", "Steering Committee"],
  },
  { key: "escalationDate", label: "Escalation Date", kind: "date" },
  { key: "closureDate", label: "Closure Date", kind: "date" },
  { key: "lastReviewDate", label: "Last Review Date", kind: "date" },
  { key: "nextReviewDate", label: "Next Review Date", kind: "date" },
  { key: "description", label: "Issue Description", kind: "textarea" },
  { key: "rootCause", label: "Root Cause", kind: "textarea" },
  { key: "businessImpact", label: "Business Impact", kind: "textarea" },
  { key: "resolutionPlan", label: "Resolution Plan", kind: "textarea" },
  { key: "resolutionSummary", label: "Resolution Summary", kind: "textarea" },
  { key: "lessonsLearned", label: "Lessons Learned", kind: "textarea" },
  { key: "remarks", label: "Remarks", kind: "textarea" },
];

type IssueItem = { id: string } & Record<string, string>;

export function IssueLog() {
  const { values, set, reset } = useEntryValues();
  const nextId = useIdCounter("ISS");
  const [items, setItems] = React.useState<IssueItem[]>([]);

  const addIssue = () => {
    if (!values.title?.trim()) return;
    setItems((prev) => [...prev, { id: nextId(), ...values }]);
    reset();
  };

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        icon={TriangleAlert}
        title="Issue Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No issues logged yet."
          columns={[
            { key: "id", label: "Issue ID" },
            { key: "title", label: "Title" },
            { key: "category", label: "Category" },
            { key: "assignedTo", label: "Owner" },
            { key: "priority", label: "Priority", badge: true },
            { key: "status", label: "Status", badge: true },
          ]}
        />
      </SectionCard>

      <SectionCard icon={TriangleAlert} title="New Issue">
        <EntryFields defs={ISSUE_FIELDS} values={values} set={set} />
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addIssue}
            className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            Add Issue
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
