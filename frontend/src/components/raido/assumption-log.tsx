"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
import {
  EntryFields,
  useEntryValues,
  useIdCounter,
  type FieldDef,
} from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";

// Fields per §4.8 Assumption Log. Validation Date/Status already functions
// as this log's review-style checkpoint (per the spec), so no proposed
// Last/Next Review Date addition here.
const ASSUMPTION_FIELDS: FieldDef[] = [
  { key: "title", label: "Title", kind: "text", mandatory: true },
  { key: "category", label: "Category", kind: "text" },
  { key: "raisedBy", label: "Raised By", kind: "text" },
  { key: "raisedDate", label: "Raised Date", kind: "date" },
  { key: "owner", label: "Owner", kind: "text" },
  { key: "dependencyReference", label: "Dependency Reference", kind: "text", hint: "Optional link to a Dependency record" },
  {
    key: "probabilityOfFailure",
    label: "Probability of Failure",
    kind: "select",
    options: ["Low", "Medium", "High"],
  },
  {
    key: "impactRating",
    label: "Impact Rating",
    kind: "select",
    options: ["Low", "Medium", "High", "Critical"],
    mandatory: true,
  },
  { key: "validationDate", label: "Validation Date", kind: "date" },
  {
    key: "validationStatus",
    label: "Validation Status",
    kind: "select",
    options: ["Pending", "Validated", "Invalid"],
  },
  {
    key: "status",
    label: "Current Status",
    kind: "select",
    options: ["Open", "Closed", "Cancelled"],
  },
  { key: "lastUpdated", label: "Last Updated", kind: "date" },
  { key: "description", label: "Detailed Description", kind: "textarea" },
  { key: "impactIfInvalid", label: "Impact if Invalid", kind: "textarea" },
  { key: "mitigationPlan", label: "Mitigation Plan", kind: "textarea" },
  { key: "contingencyPlan", label: "Contingency Plan", kind: "textarea" },
  { key: "remarks", label: "Remarks", kind: "textarea" },
];

type AssumptionItem = { id: string } & Record<string, string>;

export function AssumptionLog() {
  const { values, set, reset } = useEntryValues();
  const nextId = useIdCounter("ASM");
  const [items, setItems] = React.useState<AssumptionItem[]>([]);

  const addAssumption = () => {
    if (!values.title?.trim()) return;
    setItems((prev) => [...prev, { id: nextId(), ...values }]);
    reset();
  };

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={HelpCircle} title="New Assumption">
        <EntryFields defs={ASSUMPTION_FIELDS} values={values} set={set} />
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addAssumption}
            className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            Add Assumption
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        icon={HelpCircle}
        title="Assumption Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No assumptions logged yet."
          columns={[
            { key: "id", label: "Assumption ID" },
            { key: "title", label: "Title" },
            { key: "category", label: "Category" },
            { key: "owner", label: "Owner" },
            { key: "impactRating", label: "Impact", badge: true },
            { key: "status", label: "Status", badge: true },
          ]}
        />
      </SectionCard>
    </div>
  );
}
