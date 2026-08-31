"use client";

import * as React from "react";
import { Siren } from "lucide-react";

import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { usePageBanner } from "@/stores/page-banner";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import { Button } from "@/components/ui/button";
import { AiRowSuggestionsPanel, AiRowSuggestionsTrigger } from "@/components/ai/ai-row-suggestions-panel";
import {
  useCreateDEAssessmentAlert,
  type DEAssessment,
  type DEAssessmentAlertPayload,
} from "@/lib/api/de-assessment";

const ALERT_PREVIEW_FIELDS = [
  { key: "brief_description", label: "Description" },
  { key: "alert_category", label: "Category" },
  { key: "raised_on", label: "Raised On" },
] as const;

function buildAlertPayload(values: Record<string, string>): DEAssessmentAlertPayload {
  return {
    alert_category: values.alert_category || undefined,
    brief_description: values.brief_description,
    detailed_description: values.detailed_description || undefined,
    raised_on: values.raised_on || undefined,
  };
}

// Category enum shared with Risk Category (see backend Category StrEnum).
const ALERT_CATEGORIES = [
  "Core Delivery",
  "People",
  "Operational",
  "Customer",
  "Financial",
  "Compliance",
] as const;

const ALERT_FIELDS: FieldDef[] = [
  { key: "alert_category", label: "Alert Category", kind: "select", options: ALERT_CATEGORIES },
  {
    key: "brief_description",
    label: "Brief Description",
    kind: "text",
    mandatory: true,
    placeholder: "One-line summary of the alert",
  },
  { key: "raised_on", label: "Raised On", kind: "date" },
  {
    key: "detailed_description",
    label: "Detailed Description",
    kind: "textarea",
    placeholder: "Describe the concern, its impact, and the support needed",
  },
];

export function AlertRegisterTab({
  projectId,
  periodId,
  assessment,
}: {
  projectId: string | null;
  periodId: string | null;
  assessment: DEAssessment | null | undefined;
}) {
  const { values, set, reset } = useEntryValues();
  const createAlert = useCreateDEAssessmentAlert(projectId, assessment?.id ?? null);
  const [descriptionError, setDescriptionError] = React.useState<string | null>(null);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const addAlert = () => {
    if (!assessment) return;
    if (!values.brief_description?.trim()) {
      const message = "Brief Description is required.";
      setDescriptionError(message);
      showError(message);
      return;
    }
    setDescriptionError(null);
    const payload = buildAlertPayload(values);
    createAlert.mutate(payload, {
      onSuccess: () => {
        reset();
        showSuccess("Alert Added Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to add alert."),
    });
  };

  if (!assessment) {
    return (
      <EmptyState>Submit the assessment above first, then raise alerts against it here.</EmptyState>
    );
  }

  const items = assessment.alerts;

  return (
    <div className="flex flex-col gap-8">
      <AiRowSuggestionsTrigger
        projectId={projectId ?? ""}
        screen="de_assessment_alerts"
        periodId={periodId}
        itemLabel="Alert"
      />

      <SectionCard icon={Siren} title="Alert Register" aside={<AutoBadge label={`${items.length} logged`} />}>
        <RegisterImportToolbar
          defs={ALERT_FIELDS}
          itemLabelPlural="Alerts"
          buildPayload={buildAlertPayload}
          createMutation={createAlert}
        />
        <RegisterTable
          items={items}
          emptyLabel="No alerts raised yet."
          columns={[
            { key: "alert_code", label: "Alert Code" },
            { key: "alert_category", label: "Category" },
            { key: "brief_description", label: "Brief Description" },
            { key: "raised_on", label: "Raised On" },
          ]}
        />
      </SectionCard>

      <AiRowSuggestionsPanel
        projectId={projectId ?? ""}
        screen="de_assessment_alerts"
        periodId={periodId}
        itemLabel="Alert"
        previewFields={ALERT_PREVIEW_FIELDS}
        buildPayload={buildAlertPayload}
        createMutation={createAlert}
      />

      <SectionCard icon={Siren} title="New Alert">
        <EntryFields
          defs={ALERT_FIELDS}
          values={values}
          set={set}
          errors={descriptionError ? { brief_description: descriptionError } : undefined}
        />
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addAlert}
            disabled={createAlert.isPending}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {createAlert.isPending ? <ButtonSpinner /> : null}
            Add Alert
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
