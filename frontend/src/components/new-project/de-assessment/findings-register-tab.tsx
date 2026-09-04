"use client";

import * as React from "react";
import { Table } from "lucide-react";

import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import { Button } from "@/components/ui/button";
import { usePageBanner } from "@/stores/page-banner";
import {
  FINDING_CATEGORY_OPTIONS,
  FINDING_CLASSIFICATION_OPTIONS,
  useCreateDEAssessmentFinding,
  useDEAssessmentFindings,
  type DEAssessmentFindingPayload,
  type FindingCategory,
  type FindingClassification,
  type FindingStatus,
} from "@/lib/api/de-assessment";

const FINDING_STATUSES: FindingStatus[] = ["Open", "Closed", "On Hold", "Deferred"];

const FINDING_FIELDS: FieldDef[] = [
  { key: "category", label: "Category", kind: "select", options: FINDING_CATEGORY_OPTIONS, mandatory: true },
  { key: "classification", label: "Classification", kind: "select", options: FINDING_CLASSIFICATION_OPTIONS, mandatory: true },
  { key: "action_taken", label: "Action Taken", kind: "text", placeholder: "Action taken" },
  { key: "finding_date", label: "Date", kind: "date" },
  { key: "status", label: "Status", kind: "select", options: FINDING_STATUSES },
  { key: "remarks", label: "Remarks", kind: "text", placeholder: "Remarks" },
];

export function FindingsRegisterTab({ projectId }: { projectId: string | null }) {
  const { values, set, reset } = useEntryValues();
  const { data: items = [] } = useDEAssessmentFindings(projectId);
  const createFinding = useCreateDEAssessmentFinding(projectId);
  const [errors, setErrors] = React.useState<{ category?: string; classification?: string }>({});
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  // sequence_no is assigned server-side (per project), so it's omitted here —
  // which also means bulk import needs no client-side counter.
  const buildFindingPayload = (v: Record<string, string>): DEAssessmentFindingPayload => ({
    category: v.category as FindingCategory,
    classification: v.classification as FindingClassification,
    action_taken: v.action_taken || undefined,
    finding_date: v.finding_date || undefined,
    status: (v.status as FindingStatus) || "Open",
    remarks: v.remarks || undefined,
  });

  const addFinding = () => {
    const next: { category?: string; classification?: string } = {};
    if (!values.category) next.category = "Category is required.";
    if (!values.classification) next.classification = "Classification is required.";
    if (next.category || next.classification) {
      setErrors(next);
      showError(next.category ?? next.classification ?? "Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    const payload = buildFindingPayload(values);
    createFinding.mutate(payload, {
      onSuccess: () => {
        reset();
        showSuccess("Finding Added Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to add finding."),
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={Table} title="Findings Register" aside={<AutoBadge label={`${items.length} logged`} />}>
        <RegisterImportToolbar
          defs={FINDING_FIELDS}
          itemLabelPlural="Findings"
          buildPayload={buildFindingPayload}
          createMutation={createFinding}
        />
        <RegisterTable
          items={items}
          emptyLabel="No findings logged yet."
          columns={[
            { key: "sequence_no", label: "#" },
            { key: "category", label: "Category" },
            { key: "classification", label: "Classification" },
            { key: "action_taken", label: "Action Taken" },
            { key: "finding_date", label: "Date" },
            { key: "status", label: "Status", badge: true },
            { key: "remarks", label: "Remarks" },
          ]}
        />
      </SectionCard>

      <SectionCard icon={Table} title="New Finding">
        <EntryFields
          defs={FINDING_FIELDS}
          values={values}
          set={set}
          errors={Object.keys(errors).length > 0 ? errors : undefined}
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
