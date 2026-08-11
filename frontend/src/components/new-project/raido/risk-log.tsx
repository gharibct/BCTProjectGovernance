"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { usePageBanner } from "@/stores/page-banner";
import {
  EntryFields,
  useEntryValues,
  type FieldDef,
} from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { AiRowSuggestionsPanel, AiRowSuggestionsTrigger } from "@/components/ai/ai-row-suggestions-panel";
import { useNewProjectId } from "@/stores/new-project-ui";
import { useUsers } from "@/lib/api/reference-data";
import { useBaselinePeriodId } from "@/lib/period-utils";
import {
  useCreateRisk,
  useRisks,
  useUpdateRisk,
  type RiskLog as RiskLogItem,
  type RiskLogPayload,
} from "@/lib/api/raid";

const RISK_PREVIEW_FIELDS = [
  { key: "risk_title", label: "Title" },
  { key: "risk_category", label: "Category" },
  { key: "probability", label: "Probability" },
  { key: "impact", label: "Impact" },
] as const;

// Fields per §4.5 Risk Log. Keys match RiskLogCreate's field names 1:1 so
// EntryFields' values can be posted straight through (after the escalation
// Y/N -> boolean and severity conversions below).
function useRiskFields(): FieldDef[] {
  const { data: users } = useUsers();
  const userChoices = (users ?? []).map((u) => ({ value: u.id, label: u.full_name }));

  return [
    { key: "risk_title", label: "Risk Title", kind: "text", mandatory: true },
    {
      key: "risk_category",
      label: "Risk Category",
      kind: "select",
      options: ["Core Delivery", "People", "Operational", "Customer", "Financial", "Compliance"],
    },
    { key: "risk_type", label: "Risk Type", kind: "select", options: ["Internal", "External"] },
    { key: "identified_by", label: "Identified By", kind: "select", choices: userChoices },
    { key: "identified_date", label: "Identified Date", kind: "date" },
    { key: "risk_owner", label: "Risk Owner", kind: "select", choices: userChoices },
    { key: "trigger_event", label: "Trigger / Event", kind: "text" },
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
      key: "response_strategy",
      label: "Response Strategy",
      kind: "select",
      options: ["Avoid", "Mitigate", "Transfer", "Accept"],
    },
    { key: "affected_deliverables", label: "Affected Deliverables", kind: "text" },
    { key: "affected_milestone", label: "Affected Milestone", kind: "text" },
    { key: "target_resolution_date", label: "Target Resolution Date", kind: "date" },
    { key: "escalation_required", label: "Escalation Required", kind: "select", options: ["Y", "N"] },
    { key: "escalated_to", label: "Escalated To", kind: "text" },
    { key: "last_review_date", label: "Last Review Date", kind: "date" },
    { key: "next_review_date", label: "Next Review Date", kind: "date" },
    { key: "risk_description", label: "Risk Description", kind: "textarea" },
    { key: "mitigation_plan", label: "Mitigation Plan", kind: "textarea" },
    { key: "contingency_plan", label: "Contingency Plan", kind: "textarea" },
    { key: "residual_risk", label: "Residual Risk", kind: "textarea" },
    { key: "remarks", label: "Remarks", kind: "textarea" },
  ];
}

// Risk Score = Probability × Impact, bucketed into a Severity label — sent
// to the backend as-is (RiskLogCreate.severity), which otherwise has no way
// to compute it itself.
const SCALE: Record<string, number> = {
  "very low": 1,
  low: 2,
  medium: 3,
  high: 4,
  "very high": 5,
  critical: 5,
};

function severityFor(probability: string, impact: string): string | undefined {
  const p = SCALE[probability.toLowerCase()] ?? 0;
  const i = SCALE[impact.toLowerCase()] ?? 0;
  const score = p * i;
  if (!score) return undefined;
  if (score >= 16) return "Critical";
  if (score >= 9) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

// Shared by the manual "Add Risk" button and the AI row-suggestions panel's
// Apply (both ultimately call the same createRisk mutation with this shape).
function buildRiskPayload(values: Record<string, string>): RiskLogPayload {
  return {
    ...values,
    severity: severityFor(values.probability ?? "", values.impact ?? ""),
    escalation_required: values.escalation_required === "Y",
  };
}

export function RiskLog() {
  const projectId = useNewProjectId();
  const periodId = useBaselinePeriodId();
  const { values, set, reset } = useEntryValues();
  const { data: items = [] } = useRisks(projectId);
  const createRisk = useCreateRisk(projectId);
  const updateRisk = useUpdateRisk(projectId);
  const fields = useRiskFields();
  const { data: users } = useUsers();
  const userName = (id: string | null) => users?.find((u) => u.id === id)?.full_name ?? "—";
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const addRisk = () => {
    if (!values.risk_title?.trim()) return;
    createRisk.mutate(buildRiskPayload(values), {
      onSuccess: () => {
        reset();
        showSuccess("Risk Added Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to add risk."),
    });
  };

  if (!projectId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Create the project on the Project Profile tab first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <AiRowSuggestionsTrigger projectId={projectId} screen="risks" periodId={periodId} itemLabel="Risk" />

      <SectionCard
        icon={ShieldAlert}
        title="Risk Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No risks logged yet."
          columns={[
            { key: "risk_code", label: "Risk ID" },
            { key: "risk_title", label: "Title" },
            { key: "risk_category", label: "Category" },
            { key: "risk_owner", label: "Owner", render: (item: RiskLogItem) => userName(item.risk_owner) },
            { key: "severity", label: "Severity", badge: true },
            { key: "current_status", label: "Status", badge: true },
          ]}
        />
      </SectionCard>

      <AiRowSuggestionsPanel
        projectId={projectId}
        screen="risks"
        periodId={periodId}
        itemLabel="Risk"
        previewFields={RISK_PREVIEW_FIELDS}
        buildPayload={buildRiskPayload}
        createMutation={createRisk}
        updateMutation={updateRisk}
      />

      <SectionCard icon={ShieldAlert} title="New Risk">
        <EntryFields defs={fields} values={values} set={set} />
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addRisk}
            disabled={createRisk.isPending}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {createRisk.isPending ? <ButtonSpinner /> : null}
            Add Risk
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
