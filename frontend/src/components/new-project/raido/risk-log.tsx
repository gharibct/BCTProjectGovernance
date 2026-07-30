"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
import {
  EntryFields,
  useEntryValues,
  useIdCounter,
  type FieldDef,
} from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";

// Fields per §4.5 Risk Log.
const RISK_FIELDS: FieldDef[] = [
  { key: "title", label: "Risk Title", kind: "text", mandatory: true },
  {
    key: "category",
    label: "Risk Category",
    kind: "select",
    options: ["Core Delivery", "People", "Operational", "Customer", "Financial", "Compliance"],
  },
  { key: "type", label: "Risk Type", kind: "select", options: ["Internal", "External"] },
  { key: "identifiedBy", label: "Identified By", kind: "text" },
  { key: "identifiedDate", label: "Identified Date", kind: "date" },
  { key: "owner", label: "Risk Owner", kind: "text" },
  { key: "trigger", label: "Trigger / Event", kind: "text" },
  {
    key: "probability",
    label: "Probability",
    kind: "select",
    options: ["Very Low", "Low", "Medium", "High", "Very High"],
    mandatory: true,
  },
  {
    key: "impact",
    label: "Impact",
    kind: "select",
    options: ["Very Low", "Low", "Medium", "High", "Critical"],
    mandatory: true,
  },
  {
    key: "responseStrategy",
    label: "Response Strategy",
    kind: "select",
    options: ["Avoid", "Mitigate", "Transfer", "Accept"],
  },
  { key: "affectedDeliverables", label: "Affected Deliverables", kind: "text" },
  { key: "affectedMilestone", label: "Affected Milestone", kind: "text" },
  { key: "targetResolutionDate", label: "Target Resolution Date", kind: "date" },
  {
    key: "status",
    label: "Current Status",
    kind: "select",
    options: ["Open", "Monitoring", "Closed"],
  },
  { key: "escalationRequired", label: "Escalation Required", kind: "select", options: ["Y", "N"] },
  { key: "escalatedTo", label: "Escalated To", kind: "text" },
  { key: "lastReviewDate", label: "Last Review Date", kind: "date" },
  { key: "nextReviewDate", label: "Next Review Date", kind: "date" },
  { key: "description", label: "Risk Description", kind: "textarea" },
  { key: "mitigationPlan", label: "Mitigation Plan", kind: "textarea" },
  { key: "contingencyPlan", label: "Contingency Plan", kind: "textarea" },
  { key: "residualRisk", label: "Residual Risk", kind: "textarea" },
  { key: "remarks", label: "Remarks", kind: "textarea" },
];

// Risk Score = Probability × Impact, bucketed into a Severity label.
const SCALE: Record<string, number> = {
  "very low": 1,
  low: 2,
  medium: 3,
  high: 4,
  "very high": 5,
  critical: 5,
};

function severityFor(probability: string, impact: string): string {
  const p = SCALE[probability.toLowerCase()] ?? 0;
  const i = SCALE[impact.toLowerCase()] ?? 0;
  const score = p * i;
  if (!score) return "";
  if (score >= 16) return "Critical";
  if (score >= 9) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

type RiskItem = { id: string; severity: string } & Record<string, string>;

export function RiskLog() {
  const { values, set, reset } = useEntryValues();
  const nextId = useIdCounter("RSK");
  const [items, setItems] = React.useState<RiskItem[]>([]);

  const addRisk = () => {
    if (!values.title?.trim()) return;
    const severity = severityFor(values.probability ?? "", values.impact ?? "");
    setItems((prev) => [...prev, { id: nextId(), ...values, severity }]);
    reset();
  };

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        icon={ShieldAlert}
        title="Risk Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No risks logged yet."
          columns={[
            { key: "id", label: "Risk ID" },
            { key: "title", label: "Title" },
            { key: "category", label: "Category" },
            { key: "owner", label: "Owner" },
            { key: "severity", label: "Severity", badge: true },
            { key: "status", label: "Status", badge: true },
          ]}
        />
      </SectionCard>

      <SectionCard icon={ShieldAlert} title="New Risk">
        <EntryFields defs={RISK_FIELDS} values={values} set={set} />
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addRisk}
            className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            Add Risk
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
