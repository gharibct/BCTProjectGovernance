"use client";

import { toast } from "sonner";
import { Siren } from "lucide-react";

import { AutoBadge, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";
import {
  useCreateDEAssessmentAlert,
  type DEAssessment,
  type DEAssessmentAlertPayload,
} from "@/lib/api/de-assessment";

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
  assessment,
}: {
  projectId: string | null;
  assessment: DEAssessment | null | undefined;
}) {
  const { values, set, reset } = useEntryValues();
  const createAlert = useCreateDEAssessmentAlert(projectId, assessment?.id ?? null);

  const addAlert = () => {
    if (!assessment || !values.brief_description?.trim()) return;
    const payload: DEAssessmentAlertPayload = {
      alert_category: values.alert_category || undefined,
      brief_description: values.brief_description,
      detailed_description: values.detailed_description || undefined,
      raised_on: values.raised_on || undefined,
    };
    createAlert.mutate(payload, {
      onSuccess: () => {
        reset();
        toast.success("Alert Added Successfully");
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add alert."),
    });
  };

  if (!assessment) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Submit the assessment above first, then raise alerts against it here.
      </p>
    );
  }

  const items = assessment.alerts;

  return (
    <div className="flex flex-col gap-8">
      {assessment.de_assessed_project_health !== "Green" && items.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This assessment is rated {assessment.de_assessed_project_health} — raise at least one alert below.
        </p>
      ) : null}

      <SectionCard icon={Siren} title="Alert Register" aside={<AutoBadge label={`${items.length} logged`} />}>
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

      <SectionCard icon={Siren} title="New Alert">
        <EntryFields defs={ALERT_FIELDS} values={values} set={set} />
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
