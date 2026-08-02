"use client";

import * as React from "react";
import { ClipboardCheck } from "lucide-react";

import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
import {
  EntryFields,
  useEntryValues,
  useIdCounter,
  type FieldDef,
} from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";

// Per §4.11 Contractual Compliance: commitments carry their own cadence
// (Frequency), so Actual is captured per-commitment here rather than fixed
// for the whole screen — unlike the New Project charter's definition-stage
// version of this form, this one is for an active project, so Actual/Status
// are recorded alongside the definition instead of added later.
const FREQUENCIES = [
  "One Time",
  "Weekly",
  "Fortnight",
  "Monthly",
  "Quarterly",
  "Half Yearly",
  "Phase Wise",
] as const;

const COMMITMENT_FIELDS: FieldDef[] = [
  { key: "name", label: "Name of the Commitment", kind: "text", mandatory: true },
  {
    key: "frequency",
    label: "Frequency",
    kind: "select",
    options: FREQUENCIES,
    mandatory: true,
  },
  { key: "formula", label: "Formula", kind: "text", placeholder: "e.g. Resolved / Total" },
  { key: "target", label: "Target", kind: "number" },
  {
    key: "penaltyApplicable",
    label: "Penalty Applicable",
    kind: "select",
    options: ["Y", "N"],
  },
  { key: "penaltyValue", label: "Penalty Value", kind: "number" },
  { key: "actual", label: "Actual", kind: "number" },
];

function metStatus(target: string, actual: string): string {
  const t = Number(target);
  const a = Number(actual);
  if (!target || !actual || Number.isNaN(t) || Number.isNaN(a)) return "";
  return a >= t ? "Met" : "Not Met";
}

type CommitmentItem = { id: string; status: string } & Record<string, string>;

export function CommitmentsTab() {
  const { values, set, reset } = useEntryValues();
  const nextId = useIdCounter("CC");
  const [items, setItems] = React.useState<CommitmentItem[]>([]);

  const addCommitment = () => {
    if (!values.name?.trim()) return;
    const status = metStatus(values.target ?? "", values.actual ?? "");
    setItems((prev) => [...prev, { id: nextId(), ...values, status }]);
    reset();
  };

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        icon={ClipboardCheck}
        title="Commitments Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No commitments defined yet."
          columns={[
            { key: "id", label: "Commitment ID" },
            { key: "name", label: "Commitment" },
            { key: "frequency", label: "Frequency" },
            { key: "target", label: "Target", align: "right" },
            { key: "actual", label: "Actual", align: "right" },
            { key: "status", label: "Status", badge: true },
          ]}
        />
      </SectionCard>

      <SectionCard icon={ClipboardCheck} title="New Commitment">
        <EntryFields defs={COMMITMENT_FIELDS} values={values} set={set} />
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addCommitment}
            className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            Add Commitment
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
