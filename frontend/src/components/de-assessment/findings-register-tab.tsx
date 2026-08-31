"use client";

import * as React from "react";
import { Table } from "lucide-react";

import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { usePageBanner } from "@/stores/page-banner";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import { Button } from "@/components/ui/button";
import { AiRowSuggestionsPanel, AiRowSuggestionsTrigger } from "@/components/ai/ai-row-suggestions-panel";
import {
  useCreateDEAssessmentFinding,
  type DEAssessment,
  type DEAssessmentFindingPayload,
  type FindingClassification,
  type FindingStatus,
} from "@/lib/api/de-assessment";

const CLASSIFICATIONS: FindingClassification[] = ["Observation", "Recommendation"];
const FINDING_STATUSES: FindingStatus[] = ["Open", "Closed", "On Hold", "Deferred"];

const FINDING_PREVIEW_FIELDS = [
  { key: "classification", label: "Classification" },
  { key: "action_taken", label: "Action Taken" },
  { key: "status", label: "Status" },
] as const;

const FINDING_FIELDS: FieldDef[] = [
  { key: "classification", label: "Classification", kind: "select", options: CLASSIFICATIONS, mandatory: true },
  { key: "action_taken", label: "Action Taken", kind: "text", placeholder: "Action taken" },
  { key: "finding_date", label: "Date", kind: "date" },
  { key: "status", label: "Status", kind: "select", options: FINDING_STATUSES },
  { key: "remarks", label: "Remarks", kind: "text", placeholder: "Remarks" },
];

export function FindingsRegisterTab({
  projectId,
  periodId,
  assessment,
}: {
  projectId: string | null;
  periodId: string | null;
  assessment: DEAssessment | null | undefined;
}) {
  const { values, set, reset } = useEntryValues();
  const createFinding = useCreateDEAssessmentFinding(projectId, assessment?.id ?? null);
  const [classificationError, setClassificationError] = React.useState<string | null>(null);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const buildFindingPayload = (v: Record<string, string>): DEAssessmentFindingPayload => ({
    sequence_no: (assessment?.findings.length ?? 0) + 1,
    classification: v.classification as FindingClassification,
    action_taken: v.action_taken || undefined,
    finding_date: v.finding_date || undefined,
    status: (v.status as FindingStatus) || "Open",
    remarks: v.remarks || undefined,
  });

  // Bulk import creates several rows in one sequential loop without a
  // re-render in between, so buildFindingPayload's `assessment.findings.length`
  // snapshot would give every row the same sequence_no — this variant
  // advances its own counter (in a ref, since it must survive being called
  // repeatedly after this render has already committed) across the batch.
  // The ref is only read/written inside the callback itself (never during
  // render), rebasing to the current findings count whenever that's grown
  // past the ref (i.e. after any successful create).
  const importSeqRef = React.useRef<number | null>(null);
  const buildFindingPayloadForImport = (v: Record<string, string>): DEAssessmentFindingPayload => {
    const base = (assessment?.findings.length ?? 0) + 1;
    if (importSeqRef.current === null || importSeqRef.current < base) {
      importSeqRef.current = base;
    }
    const payload = { ...buildFindingPayload(v), sequence_no: importSeqRef.current };
    importSeqRef.current += 1;
    return payload;
  };

  const addFinding = () => {
    if (!assessment) return;
    if (!values.classification) {
      const message = "Classification is required.";
      setClassificationError(message);
      showError(message);
      return;
    }
    setClassificationError(null);
    const payload = buildFindingPayload(values);
    createFinding.mutate(payload, {
      onSuccess: () => {
        reset();
        showSuccess("Finding Added Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to add finding."),
    });
  };

  if (!assessment) {
    return (
      <EmptyState>Submit the assessment above first, then log findings against it here.</EmptyState>
    );
  }

  const items = assessment.findings;

  return (
    <div className="flex flex-col gap-8">
      <AiRowSuggestionsTrigger
        projectId={projectId ?? ""}
        screen="de_assessment_findings"
        periodId={periodId}
        itemLabel="Finding"
      />

      <SectionCard icon={Table} title="Findings Register" aside={<AutoBadge label={`${items.length} logged`} />}>
        <RegisterImportToolbar
          defs={FINDING_FIELDS}
          itemLabelPlural="Findings"
          buildPayload={buildFindingPayloadForImport}
          createMutation={createFinding}
        />
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

      <AiRowSuggestionsPanel
        projectId={projectId ?? ""}
        screen="de_assessment_findings"
        periodId={periodId}
        itemLabel="Finding"
        previewFields={FINDING_PREVIEW_FIELDS}
        buildPayload={buildFindingPayload}
        createMutation={createFinding}
      />

      <SectionCard icon={Table} title="New Finding">
        <EntryFields
          defs={FINDING_FIELDS}
          values={values}
          set={set}
          errors={classificationError ? { classification: classificationError } : undefined}
        />
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
