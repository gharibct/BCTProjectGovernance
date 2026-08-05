"use client";

import { toast } from "sonner";
import { Table } from "lucide-react";

import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";
import {
  useCreateDEAssessmentFinding,
  type DEAssessment,
  type DEAssessmentFindingPayload,
  type FindingClassification,
  type FindingStatus,
} from "@/lib/api/de-assessment";

const CLASSIFICATIONS: FindingClassification[] = ["Observation", "Recommendation"];
const FINDING_STATUSES: FindingStatus[] = ["Open", "Closed", "On Hold", "Deferred"];

const FINDING_FIELDS: FieldDef[] = [
  { key: "classification", label: "Classification", kind: "select", options: CLASSIFICATIONS, mandatory: true },
  { key: "action_taken", label: "Action Taken", kind: "text", placeholder: "Action taken" },
  { key: "finding_date", label: "Date", kind: "date" },
  { key: "status", label: "Status", kind: "select", options: FINDING_STATUSES },
  { key: "remarks", label: "Remarks", kind: "text", placeholder: "Remarks" },
];

export function FindingsRegisterTab({
  projectId,
  assessment,
}: {
  projectId: string | null;
  assessment: DEAssessment | null | undefined;
}) {
  const { values, set, reset } = useEntryValues();
  const createFinding = useCreateDEAssessmentFinding(projectId, assessment?.id ?? null);

  const addFinding = () => {
    if (!assessment || !values.classification) return;
    const payload: DEAssessmentFindingPayload = {
      sequence_no: assessment.findings.length + 1,
      classification: values.classification as FindingClassification,
      action_taken: values.action_taken || undefined,
      finding_date: values.finding_date || undefined,
      status: (values.status as FindingStatus) || "Open",
      remarks: values.remarks || undefined,
    };
    createFinding.mutate(payload, {
      onSuccess: () => {
        reset();
        toast.success("Finding Added Successfully");
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add finding."),
    });
  };

  if (!assessment) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Submit the assessment above first, then log findings against it here.
      </p>
    );
  }

  const items = assessment.findings;

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={Table} title="Findings Register" aside={<AutoBadge label={`${items.length} logged`} />}>
        <RegisterTable
          items={items}
          emptyLabel="No findings logged yet."
          columns={[
            { key: "sequence_no", label: "#" },
            { key: "classification", label: "Classification" },
            { key: "action_taken", label: "Action Taken" },
            { key: "finding_date", label: "Date" },
            { key: "status", label: "Status", badge: true },
            { key: "remarks", label: "Remarks" },
          ]}
        />
      </SectionCard>

      <SectionCard icon={Table} title="New Finding">
        <EntryFields defs={FINDING_FIELDS} values={values} set={set} />
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addFinding}
            disabled={createFinding.isPending}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {createFinding.isPending ? <ButtonSpinner /> : null}
            Add Finding
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
