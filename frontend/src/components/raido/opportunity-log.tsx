"use client";

import * as React from "react";
import { TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
import {
  EntryFields,
  useEntryValues,
  useIdCounter,
  type FieldDef,
} from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";

// Fields per §4.9 Opportunity Log, including the proposed Last/Next Review
// Date addition for parity with the Risk Log's monthly-review cadence.
const OPPORTUNITY_FIELDS: FieldDef[] = [
  { key: "title", label: "Opportunity Title", kind: "text", mandatory: true },
  { key: "category", label: "Category", kind: "text" },
  { key: "identifiedBy", label: "Identified By", kind: "text" },
  { key: "identifiedDate", label: "Identified Date", kind: "date" },
  { key: "owner", label: "Opportunity Owner", kind: "text" },
  {
    key: "impact",
    label: "Impact",
    kind: "select",
    options: ["Very Low", "Low", "Medium", "High"],
    mandatory: true,
  },
  {
    key: "expectedBenefit",
    label: "Expected Benefit",
    kind: "select",
    options: ["Time", "Cost", "Quality", "Revenue"],
  },
  { key: "estimatedBenefit", label: "Estimated Benefit", kind: "number", hint: "Quantified value" },
  {
    key: "benefitType",
    label: "Benefit Type",
    kind: "select",
    options: ["Cost Saving", "Revenue Increase", "Quality Improvement", "Customer Satisfaction"],
  },
  {
    key: "exploitationStrategy",
    label: "Exploitation Strategy",
    kind: "select",
    options: ["Exploit", "Enhance", "Share", "Accept"],
  },
  { key: "targetImplementationDate", label: "Target Implementation Date", kind: "date" },
  {
    key: "status",
    label: "Status",
    kind: "select",
    options: ["Identified", "Approved", "Implemented", "Closed"],
  },
  { key: "approvalRequired", label: "Approval Required", kind: "select", options: ["Y", "N"] },
  { key: "approvedBy", label: "Approved By", kind: "text" },
  { key: "actualBenefit", label: "Actual Benefit", kind: "number" },
  { key: "closureDate", label: "Closure Date", kind: "date" },
  { key: "lastReviewDate", label: "Last Review Date", kind: "date" },
  { key: "nextReviewDate", label: "Next Review Date", kind: "date" },
  { key: "description", label: "Opportunity Description", kind: "textarea" },
  { key: "actionPlan", label: "Action Plan", kind: "textarea" },
  { key: "remarks", label: "Remarks", kind: "textarea" },
];

type OpportunityItem = { id: string } & Record<string, string>;

export function OpportunityLog() {
  const { values, set, reset } = useEntryValues();
  const nextId = useIdCounter("OPP");
  const [items, setItems] = React.useState<OpportunityItem[]>([]);

  const addOpportunity = () => {
    if (!values.title?.trim()) return;
    setItems((prev) => [...prev, { id: nextId(), ...values }]);
    reset();
  };

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        icon={TrendingUp}
        title="Opportunity Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No opportunities logged yet."
          columns={[
            { key: "id", label: "Opportunity ID" },
            { key: "title", label: "Title" },
            { key: "category", label: "Category" },
            { key: "owner", label: "Owner" },
            { key: "impact", label: "Impact", badge: true },
            { key: "status", label: "Status", badge: true },
          ]}
        />
      </SectionCard>

      <SectionCard icon={TrendingUp} title="New Opportunity">
        <EntryFields defs={OPPORTUNITY_FIELDS} values={values} set={set} />
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addOpportunity}
            className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            Add Opportunity
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
