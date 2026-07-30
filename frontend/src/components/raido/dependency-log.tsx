"use client";

import * as React from "react";
import { Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
import {
  EntryFields,
  useEntryValues,
  useIdCounter,
  type FieldDef,
} from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";

// Fields per §4.7 Dependency Log, including the proposed Last/Next Review
// Date addition for parity with the Risk Log's monthly-review cadence.
const DEPENDENCY_FIELDS: FieldDef[] = [
  { key: "title", label: "Dependency Title", kind: "text", mandatory: true },
  {
    key: "type",
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
  { key: "dependsOn", label: "Depends On", kind: "text" },
  { key: "relatedTask", label: "Related Task / Milestone", kind: "text" },
  { key: "requiredBy", label: "Required By", kind: "date" },
  { key: "owner", label: "Owner", kind: "text" },
  {
    key: "status",
    label: "Dependency Status",
    kind: "select",
    options: ["Not Started", "In Progress", "Completed", "Blocked"],
  },
  {
    key: "criticality",
    label: "Criticality",
    kind: "select",
    options: ["Low", "Medium", "High", "Critical"],
    mandatory: true,
  },
  {
    key: "probabilityOfDelay",
    label: "Probability of Delay",
    kind: "select",
    options: ["Low", "Medium", "High"],
  },
  {
    key: "escalationRequired",
    label: "Escalation Required",
    kind: "select",
    options: ["Y", "N"],
  },
  {
    key: "escalationLevel",
    label: "Escalation Level",
    kind: "select",
    options: ["Project Manager", "Delivery Manager", "Steering Committee"],
  },
  { key: "actualCompletionDate", label: "Actual Completion Date", kind: "date" },
  { key: "lastUpdated", label: "Last Updated", kind: "date" },
  { key: "lastReviewDate", label: "Last Review Date", kind: "date" },
  { key: "nextReviewDate", label: "Next Review Date", kind: "date" },
  { key: "description", label: "Description", kind: "textarea" },
  { key: "impactIfDelayed", label: "Impact if Delayed", kind: "textarea" },
  { key: "mitigationPlan", label: "Mitigation Plan", kind: "textarea" },
  { key: "remarks", label: "Remarks", kind: "textarea" },
];

type DependencyItem = { id: string } & Record<string, string>;

export function DependencyLog() {
  const { values, set, reset } = useEntryValues();
  const nextId = useIdCounter("DEP");
  const [items, setItems] = React.useState<DependencyItem[]>([]);

  const addDependency = () => {
    if (!values.title?.trim()) return;
    setItems((prev) => [...prev, { id: nextId(), ...values }]);
    reset();
  };

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={Link2} title="New Dependency">
        <EntryFields defs={DEPENDENCY_FIELDS} values={values} set={set} />
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addDependency}
            className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            Add Dependency
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        icon={Link2}
        title="Dependency Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No dependencies logged yet."
          columns={[
            { key: "id", label: "Dependency ID" },
            { key: "title", label: "Title" },
            { key: "category", label: "Category" },
            { key: "owner", label: "Owner" },
            { key: "criticality", label: "Criticality", badge: true },
            { key: "status", label: "Status", badge: true },
          ]}
        />
      </SectionCard>
    </div>
  );
}
