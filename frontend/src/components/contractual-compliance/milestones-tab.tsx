"use client";

import * as React from "react";
import { Flag } from "lucide-react";

import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
import {
  EntryFields,
  useEntryValues,
  useIdCounter,
  type FieldDef,
} from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";

// Per §4.11 Milestones Linked to Payment. Unlike the New Project charter's
// definition-stage version of this form, this one is for an active project,
// so Actual Date/Value are recorded alongside the definition instead of
// added later.
const MILESTONE_STATUSES = ["Yet To Be Paid", "Paid On Time", "Delayed Payment"] as const;

const MILESTONE_FIELDS: FieldDef[] = [
  { key: "name", label: "Milestone Name", kind: "text", mandatory: true },
  {
    key: "expectedDate",
    label: "Expected Date of Payment",
    kind: "date",
    mandatory: true,
  },
  { key: "expectedValue", label: "Expected Payment Value", kind: "number" },
  { key: "actualDate", label: "Actual Date of Payment", kind: "date" },
  { key: "actualValue", label: "Actual Payment Value", kind: "number" },
  {
    key: "status",
    label: "Status",
    kind: "select",
    options: MILESTONE_STATUSES,
  },
  { key: "description", label: "Milestone Description", kind: "textarea" },
  { key: "remarks", label: "Remarks", kind: "textarea" },
];

type MilestoneItem = { id: string } & Record<string, string>;

export function MilestonesTab() {
  const { values, set, reset } = useEntryValues();
  const nextId = useIdCounter("MS");
  const [items, setItems] = React.useState<MilestoneItem[]>([]);

  const addMilestone = () => {
    if (!values.name?.trim()) return;
    setItems((prev) => [...prev, { id: nextId(), ...values }]);
    reset();
  };

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        icon={Flag}
        title="Milestones Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No milestones defined yet."
          columns={[
            { key: "id", label: "Milestone ID" },
            { key: "name", label: "Milestone" },
            { key: "expectedDate", label: "Expected Date" },
            { key: "expectedValue", label: "Expected Value", align: "right" },
            { key: "actualDate", label: "Actual Date" },
            { key: "actualValue", label: "Actual Value", align: "right" },
            { key: "status", label: "Status", badge: true },
            { key: "remarks", label: "Remarks" },
          ]}
        />
      </SectionCard>

      <SectionCard icon={Flag} title="New Milestone">
        <EntryFields defs={MILESTONE_FIELDS} values={values} set={set} />
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addMilestone}
            className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            Add Milestone
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
