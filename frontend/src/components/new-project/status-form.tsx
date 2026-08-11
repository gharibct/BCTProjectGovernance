"use client";

import * as React from "react";
import { ClipboardList, Lock } from "lucide-react";

import { SectionCard, ButtonSpinner, Field, MandatoryBadge } from "@/components/forms/form-primitives";
import { usePageBanner } from "@/stores/page-banner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useNewProjectId } from "@/stores/new-project-ui";
import { useReportingPeriods } from "@/lib/api/reference-data";
import {
  useCreateStatusReport,
  useStatusReports,
  useUpdateStatusReport,
} from "@/lib/api/project-status";

// Weekly/Monthly narrative report — three bulleted free-text sections per the
// requirements (§4.4). `field` matches ProjectStatusReportCreate's keys.
const STATUS_SECTIONS = [
  {
    field: "key_accomplishments" as const,
    label: "Key Accomplishments",
    placeholder:
      "• Provide the accomplishments from last report to now, including client appreciations — in the form of bullets",
  },
  {
    field: "upcoming_key_releases" as const,
    label: "Upcoming Key Releases / Milestones / Actions",
    placeholder:
      "• Provide upcoming key activities to focus — in the form of bullets",
  },
  {
    field: "leadership_support_required" as const,
    label: "Leadership Support / Attention Required",
    placeholder:
      "• Provide the areas where leadership support is required — in the form of bullets",
  },
];

const BLANK_SECTIONS: Record<string, string> = {
  key_accomplishments: "",
  upcoming_key_releases: "",
  leadership_support_required: "",
};

export function StatusForm() {
  const projectId = useNewProjectId();
  const { data: periods } = useReportingPeriods();
  const { data: reports } = useStatusReports(projectId);
  const createReport = useCreateStatusReport(projectId);
  const updateReport = useUpdateStatusReport(projectId);

  const [periodId, setPeriodId] = React.useState("");
  const [sections, setSections] = React.useState<Record<string, string>>(BLANK_SECTIONS);
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);

  const existing = reports?.find((r) => r.period_id === periodId);

  const key = existing ? existing.id : `blank:${periodId}`;
  if (key !== syncedFor) {
    setSyncedFor(key);
    setSections(
      existing
        ? {
            key_accomplishments: existing.key_accomplishments ?? "",
            upcoming_key_releases: existing.upcoming_key_releases ?? "",
            leadership_support_required: existing.leadership_support_required ?? "",
          }
        : BLANK_SECTIONS
    );
  }

  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const save = (status: "Draft" | "Submitted") => {
    if (!projectId || !periodId) return;
    const fields = {
      key_accomplishments: sections.key_accomplishments || undefined,
      upcoming_key_releases: sections.upcoming_key_releases || undefined,
      leadership_support_required: sections.leadership_support_required || undefined,
    };
    const onSuccess = () =>
      showSuccess(status === "Submitted" ? "Status Report Submitted Successfully" : "Draft Saved Successfully");
    const onError = (err: unknown) =>
      showError(err instanceof Error ? err.message : "Failed to save status report.");

    if (existing) {
      updateReport.mutate({ id: existing.id, payload: { ...fields, status } }, { onSuccess, onError });
    } else {
      createReport.mutate({ period_id: periodId, status, ...fields }, { onSuccess, onError });
    }
  };

  if (!projectId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Create the project on the Project Profile tab first.
      </p>
    );
  }

  const isSaving = createReport.isPending || updateReport.isPending;

  return (
    <div>
      <SectionCard
        icon={ClipboardList}
        title="Project Status"
        aside={
          <Field label="Reporting Period" htmlFor="reporting-period" badge={<MandatoryBadge />}>
            <NativeSelect
              id="reporting-period"
              className="h-10 w-56"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
            >
              <option value="" disabled>
                Select…
              </option>
              {(periods ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        }
      >
        <div className="grid grid-cols-[minmax(14rem,18rem)_1fr] gap-x-8">
          {STATUS_SECTIONS.map((s) => (
            <React.Fragment key={s.field}>
              <p className="border-t border-slate-100 py-5 text-sm font-bold text-slate-800">
                {s.label}
              </p>
              <div className="border-t border-slate-100 py-5">
                <Textarea
                  aria-label={s.label}
                  placeholder={s.placeholder}
                  className="min-h-28"
                  value={sections[s.field]}
                  onChange={(e) =>
                    setSections((prev) => ({ ...prev, [s.field]: e.target.value }))
                  }
                />
              </div>
            </React.Fragment>
          ))}
        </div>
      </SectionCard>

      <div className="mt-10 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          Draft and Submitted reports are retained per period — past reports stay in history.
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="h-11 gap-2 px-6 text-sm font-semibold"
            disabled={!periodId || isSaving}
            onClick={() => save("Draft")}
          >
            {isSaving ? <ButtonSpinner /> : null}
            Save Draft
          </Button>
          <Button
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={!periodId || isSaving}
            onClick={() => save("Submitted")}
          >
            {isSaving ? <ButtonSpinner /> : null}
            Submit Report
          </Button>
        </div>
      </div>
    </div>
  );
}
