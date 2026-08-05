"use client";

import * as React from "react";
import { toast } from "sonner";
import { ClipboardList, Lock } from "lucide-react";

import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNewProjectId } from "@/stores/new-project-ui";
import {
  useCreateStatusReport,
  useLatestStatusReport,
  type ProjectStatusReport,
} from "@/lib/api/project-status";

// Weekly narrative report — three bulleted free-text sections per the
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StatusForm() {
  const projectId = useNewProjectId();
  const { data: latest } = useLatestStatusReport(projectId);
  const createReport = useCreateStatusReport(projectId);

  const [reportDate, setReportDate] = React.useState(today);
  const [sections, setSections] = React.useState<Record<string, string>>({
    key_accomplishments: "",
    upcoming_key_releases: "",
    leadership_support_required: "",
  });
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);

  const key = latest ? latest.id : latest === null ? "none" : null;
  if (key !== null && key !== syncedFor) {
    setSyncedFor(key);
    if (latest) {
      const seeded: ProjectStatusReport = latest;
      setReportDate(seeded.report_date);
      setSections({
        key_accomplishments: seeded.key_accomplishments ?? "",
        upcoming_key_releases: seeded.upcoming_key_releases ?? "",
        leadership_support_required: seeded.leadership_support_required ?? "",
      });
    }
  }

  const submit = () => {
    if (!projectId) return;
    createReport.mutate({
      report_date: reportDate,
      key_accomplishments: sections.key_accomplishments || undefined,
      upcoming_key_releases: sections.upcoming_key_releases || undefined,
      leadership_support_required: sections.leadership_support_required || undefined,
    }, {
      onSuccess: () => toast.success("Status Report Submitted Successfully"),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Failed to submit status report."),
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
    <div>
      <SectionCard
        icon={ClipboardList}
        title="Project Status"
        aside={
          <Field label="Report Date" htmlFor="report-date">
            <Input
              id="report-date"
              type="date"
              className="h-10 w-44"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </Field>
        }
      >
        <div className="grid grid-cols-[minmax(14rem,18rem)_1fr] gap-x-8">
          <p className="pb-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
            Project Current Status
          </p>
          <p className="pb-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
            Description
          </p>

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
          One report per week — past reports are retained in history.
        </p>
        <div className="flex gap-3">
          <Button
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={createReport.isPending}
            onClick={submit}
          >
            {createReport.isPending ? <ButtonSpinner /> : null}
            Submit Report
          </Button>
        </div>
      </div>
    </div>
  );
}
