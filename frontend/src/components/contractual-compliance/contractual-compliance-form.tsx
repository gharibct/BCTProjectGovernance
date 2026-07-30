"use client";

import * as React from "react";
import { CirclePlus, ClipboardCheck, Flag } from "lucide-react";

import { AutoBadge, SectionCard } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

// Per §4.11 Contractual Compliance: commitments carry their own cadence
// (Frequency), so "Actual" entry is per-commitment rather than fixed for the
// whole screen; milestone payments are event-based against expected dates.
const FREQUENCIES = [
  "One Time",
  "Weekly",
  "Fortnight",
  "Monthly",
  "Quarterly",
  "Half Yearly",
  "Phase Wise",
] as const;

const MILESTONE_STATUSES = ["Yet To Be Paid", "Paid On Time", "Delayed Payment"] as const;

type Commitment = {
  id: string;
  frequency: string;
  name: string;
  formula: string;
  target: string;
  penaltyApplicable: string;
  penaltyValue: string;
  actual: string;
  status: string;
};

type Milestone = {
  id: string;
  name: string;
  description: string;
  expectedDate: string;
  expectedValue: string;
  actualDate: string;
  actualValue: string;
  status: string;
  remarks: string;
};

function metStatus(target: string, actual: string): string {
  const t = Number(target);
  const a = Number(actual);
  if (!target || !actual || Number.isNaN(t) || Number.isNaN(a)) return "";
  return a >= t ? "Met" : "Not Met";
}

export function ContractualComplianceForm() {
  const commitmentSeq = React.useRef(0);
  const milestoneSeq = React.useRef(0);
  const [commitments, setCommitments] = React.useState<Commitment[]>([]);
  const [milestones, setMilestones] = React.useState<Milestone[]>([]);

  const addCommitment = () => {
    commitmentSeq.current += 1;
    setCommitments((prev) => [
      ...prev,
      {
        id: `CC-${String(commitmentSeq.current).padStart(3, "0")}`,
        frequency: "Monthly",
        name: "",
        formula: "",
        target: "",
        penaltyApplicable: "N",
        penaltyValue: "",
        actual: "",
        status: "",
      },
    ]);
  };

  const updateCommitment = (
    id: string,
    key: keyof Commitment,
    value: string
  ) =>
    setCommitments((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, [key]: value };
        if (key === "target" || key === "actual") {
          next.status = metStatus(next.target, next.actual);
        }
        return next;
      })
    );

  const addMilestone = () => {
    milestoneSeq.current += 1;
    setMilestones((prev) => [
      ...prev,
      {
        id: `MS-${String(milestoneSeq.current).padStart(3, "0")}`,
        name: "",
        description: "",
        expectedDate: "",
        expectedValue: "",
        actualDate: "",
        actualValue: "",
        status: "Yet To Be Paid",
        remarks: "",
      },
    ]);
  };

  const updateMilestone = (
    id: string,
    key: keyof Milestone,
    value: string
  ) =>
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [key]: value } : m))
    );

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        icon={ClipboardCheck}
        title="Contractual Commitments"
        aside={<AutoBadge label={`${commitments.length} commitment(s)`} />}
      >
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-600 uppercase">
                <th className="px-3 py-3">Frequency</th>
                <th className="px-3 py-3">Commitment</th>
                <th className="px-3 py-3">Formula</th>
                <th className="px-3 py-3 text-right">Target</th>
                <th className="px-3 py-3">Penalty</th>
                <th className="px-3 py-3 text-right">Penalty Value</th>
                <th className="px-3 py-3 text-right">Actual</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commitments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    No commitments defined yet.
                  </td>
                </tr>
              ) : (
                commitments.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2">
                      <NativeSelect
                        aria-label="Frequency"
                        className="h-9 text-sm"
                        value={c.frequency}
                        onChange={(e) => updateCommitment(c.id, "frequency", e.target.value)}
                      >
                        {FREQUENCIES.map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </NativeSelect>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="Commitment name"
                        className="h-9 w-40"
                        placeholder="e.g. Defect Resolution SLA"
                        value={c.name}
                        onChange={(e) => updateCommitment(c.id, "name", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="Formula"
                        className="h-9 w-36"
                        placeholder="e.g. Resolved / Total"
                        value={c.formula}
                        onChange={(e) => updateCommitment(c.id, "formula", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="Target"
                        type="number"
                        className="h-9 w-24 text-right tabular-nums"
                        value={c.target}
                        onChange={(e) => updateCommitment(c.id, "target", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <NativeSelect
                        aria-label="Penalty applicable"
                        className="h-9 text-sm"
                        value={c.penaltyApplicable}
                        onChange={(e) =>
                          updateCommitment(c.id, "penaltyApplicable", e.target.value)
                        }
                      >
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </NativeSelect>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="Penalty value"
                        type="number"
                        className="h-9 w-24 text-right tabular-nums"
                        value={c.penaltyValue}
                        disabled={c.penaltyApplicable !== "Y"}
                        onChange={(e) =>
                          updateCommitment(c.id, "penaltyValue", e.target.value)
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="Actual"
                        type="number"
                        className="h-9 w-24 text-right tabular-nums"
                        value={c.actual}
                        onChange={(e) => updateCommitment(c.id, "actual", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge value={c.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Button
          variant="outline"
          className="mt-5 h-10 gap-2 text-sm font-semibold"
          onClick={addCommitment}
        >
          <CirclePlus className="size-4" />
          Add Commitment
        </Button>
      </SectionCard>

      <SectionCard
        icon={Flag}
        title="Milestones Linked to Payment"
        aside={<AutoBadge label={`${milestones.length} milestone(s)`} />}
      >
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-600 uppercase">
                <th className="px-3 py-3">Milestone</th>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3">Expected Date</th>
                <th className="px-3 py-3 text-right">Expected Value</th>
                <th className="px-3 py-3">Actual Date</th>
                <th className="px-3 py-3 text-right">Actual Value</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {milestones.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    No milestones defined yet.
                  </td>
                </tr>
              ) : (
                milestones.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="Milestone name"
                        className="h-9 w-36"
                        placeholder="e.g. UAT Sign-off"
                        value={m.name}
                        onChange={(e) => updateMilestone(m.id, "name", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="Milestone description"
                        className="h-9 w-40"
                        value={m.description}
                        onChange={(e) => updateMilestone(m.id, "description", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="Expected date of payment"
                        type="date"
                        className="h-9"
                        value={m.expectedDate}
                        onChange={(e) => updateMilestone(m.id, "expectedDate", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="Expected payment value"
                        type="number"
                        className="h-9 w-28 text-right tabular-nums"
                        value={m.expectedValue}
                        onChange={(e) => updateMilestone(m.id, "expectedValue", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="Actual date of payment"
                        type="date"
                        className="h-9"
                        value={m.actualDate}
                        onChange={(e) => updateMilestone(m.id, "actualDate", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="Actual payment value"
                        type="number"
                        className="h-9 w-28 text-right tabular-nums"
                        value={m.actualValue}
                        onChange={(e) => updateMilestone(m.id, "actualValue", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <NativeSelect
                        aria-label="Status"
                        className="h-9 text-sm"
                        value={m.status}
                        onChange={(e) => updateMilestone(m.id, "status", e.target.value)}
                      >
                        {MILESTONE_STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </NativeSelect>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label="Remarks"
                        className="h-9 w-36"
                        value={m.remarks}
                        onChange={(e) => updateMilestone(m.id, "remarks", e.target.value)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Button
          variant="outline"
          className="mt-5 h-10 gap-2 text-sm font-semibold"
          onClick={addMilestone}
        >
          <CirclePlus className="size-4" />
          Add Milestone
        </Button>
      </SectionCard>
    </div>
  );
}
