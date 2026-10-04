"use client";

import * as React from "react";
import { Ban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { usePageBanner } from "@/stores/page-banner";
import {
  PROJECT_ACTIVITIES,
  restrictionFor,
  useLiftActivityRestriction,
  useProjectRestrictions,
  useSetActivityRestriction,
  type ProjectActivity,
} from "@/lib/api/activity-restrictions";
import { formatDayMonYear } from "@/lib/format-date";
import { useProject } from "@/lib/api/projects";

// One line per activity: Activity | Applicable (Yes/No) | Restriction date | Remarks | Save.
const ROW_GRID = "grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.3fr)_9rem_10.5rem_minmax(0,1.2fr)_5.5rem]";

// Every activity is applicable to a project unless it is switched off. Choosing
// "No" asks for the date it stops being required (and optional remarks); Save
// stores that. Choosing "Yes" and saving clears the restriction again — the
// choice can be changed between Yes and No as often as needed.
function ActivityRow({
  projectId,
  activity,
  label,
  hint,
  canEdit,
  defaultDate,
}: {
  projectId: string;
  /** Pre-filled "Not required from" when switching an activity to No. */
  defaultDate: string;
  activity: ProjectActivity;
  label: string;
  hint: string;
  canEdit: boolean;
}) {
  const { data: restrictions } = useProjectRestrictions(projectId);
  const restriction = restrictionFor(restrictions, activity);
  const setRestriction = useSetActivityRestriction(projectId);
  const liftRestriction = useLiftActivityRestriction(projectId);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  // null until edited, so a refetch shows the saved values.
  const [applicableEdit, setApplicableEdit] = React.useState<boolean | null>(null);
  const [date, setDate] = React.useState<string | null>(null);
  const [remarks, setRemarks] = React.useState<string | null>(null);

  const applicable = applicableEdit ?? !restriction;
  const dateValue = date ?? restriction?.not_required_from ?? defaultDate;
  const remarksValue = remarks ?? restriction?.reason ?? "";
  const busy = setRestriction.isPending || liftRestriction.isPending;

  const dirty = applicable
    ? !!restriction // Yes, but a restriction is still stored
    : !!dateValue &&
      (!restriction || dateValue !== restriction.not_required_from || remarksValue !== (restriction.reason ?? ""));

  const reset = () => {
    setApplicableEdit(null);
    setDate(null);
    setRemarks(null);
  };

  const save = () => {
    if (applicable) {
      liftRestriction.mutate(activity, {
        onSuccess: () => {
          reset();
          showSuccess(`${label} is applicable again`);
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to save."),
      });
      return;
    }
    setRestriction.mutate(
      { activity, not_required_from: dateValue, reason: remarksValue },
      {
        onSuccess: () => {
          reset();
          showSuccess(`${label} is not required from ${formatDayMonYear(dateValue)}`);
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to save."),
      },
    );
  };

  const radio = (value: boolean, text: string) => (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-700">
      <input
        type="radio"
        name={`applicable-${activity}`}
        className="size-4 accent-[#1a4a7a]"
        checked={applicable === value}
        disabled={!canEdit || busy}
        onChange={() => setApplicableEdit(value)}
      />
      {text}
    </label>
  );

  return (
    <div className={`${ROW_GRID} items-center border-t border-slate-100 py-3 first:border-t-0`}>
      <div className="md:pl-3">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {restriction ? (
            <span className="font-semibold text-amber-700">
              Not required from {formatDayMonYear(restriction.not_required_from)}
            </span>
          ) : (
            hint
          )}
        </div>
      </div>
      <div role="radiogroup" aria-label={`${label} applicable`} className="flex items-center gap-5">
        {radio(true, "Yes")}
        {radio(false, "No")}
      </div>
      <Input
        id={`nrf-${activity}`}
        aria-label={`${label} restriction date`}
        type="date"
        className="h-10"
        value={applicable ? "" : dateValue}
        disabled={!canEdit || busy || applicable}
        onChange={(e) => setDate(e.target.value)}
      />
      <Input
        id={`nrr-${activity}`}
        aria-label={`${label} remarks`}
        className="h-10"
        value={applicable ? "" : remarksValue}
        placeholder={applicable ? "" : "e.g. Project in closure"}
        disabled={!canEdit || busy || applicable}
        onChange={(e) => setRemarks(e.target.value)}
      />
      <div className="md:justify-self-end">
        <Button
          className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
          disabled={!canEdit || !dirty || busy}
          onClick={save}
        >
          {busy ? <ButtonSpinner /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}

export function ActivityRestrictionsPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  // The date starts at the later of the project start date and the tool
  // implementation date — nothing is owed before either of them.
  const { data: project } = useProject(projectId);
  const start = project?.actual_start_date ?? project?.planned_start_date ?? "";
  const tool = project?.tool_effective_date ?? "";
  const defaultDate = start > tool ? start : tool;

  return (
    <SectionCard icon={Ban} title="Activity Restrictions">
      <p className="mb-4 text-sm text-slate-500">
        Every activity is applicable unless you switch it to No. From the restriction date it is not required and can no
        longer be recorded; reports for periods starting on or after the date are not owed. Existing records stay
        visible, read-only. Setting Commitments or Payment Milestones to No also makes that module optional for
        approval, in Project Setup and Amend Project.
        {canEdit ? "" : " Only Delivery Excellence can change these."}
      </p>
      <div
        className={`${ROW_GRID} hidden rounded-lg border-b border-[#8EBBE0] bg-[#D6E9F8] px-0 py-2.5 text-xs font-bold tracking-wide text-[#205889] uppercase md:grid`}
      >
        <span className="pl-3">Activity</span>
        <span>Applicable</span>
        <span>Restriction date</span>
        <span>Remarks</span>
        <span />
      </div>
      {PROJECT_ACTIVITIES.map((a) => (
        <ActivityRow
          key={a.key}
          projectId={projectId}
          activity={a.key}
          label={a.label}
          hint={a.hint}
          canEdit={canEdit}
          defaultDate={defaultDate}
        />
      ))}
    </SectionCard>
  );
}
