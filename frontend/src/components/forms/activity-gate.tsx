"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";

import {
  ACTIVITY_LABEL,
  isRestrictedOn,
  restrictionFor,
  useProjectRestrictions,
  type ProjectActivity,
} from "@/lib/api/activity-restrictions";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { formatDayMonYear } from "@/lib/format-date";

// Wraps a screen whose activity can be switched off for a project (Admin / DE set
// it from the DE project detail). From the restriction date the activity is not
// required, so the screen stays visible — what was already recorded can still be
// read — but every control inside is disabled and a notice says why. Mirrors
// BaselineGate: a disabled <fieldset> disables all descendant inputs / selects /
// textareas / buttons; links stay clickable. The server refuses the writes too
// (409), this only decides what the UI disables.
//
// `periodDate` is the date the restriction is compared with: pass the selected
// reporting period's START date for report-type activities (or leave
// `usePeriodParam` on and the ?period= is looked up); with neither, today.
function GateInner({
  projectId,
  activity,
  usePeriodParam,
  periodDate,
  children,
}: {
  projectId?: string | null;
  activity: ProjectActivity;
  usePeriodParam: boolean;
  periodDate?: string | null;
  children: React.ReactNode;
}) {
  const routeProjectId = useParams<{ projectId?: string }>().projectId ?? null;
  const { data: restrictions } = useProjectRestrictions(projectId ?? routeProjectId);
  const { data: periods = [] } = useReportingPeriods();
  const periodId = useSearchParams().get("period");

  const onDate = periodDate ?? (usePeriodParam ? periods.find((p) => p.id === periodId)?.start_date : undefined);
  const restricted = isRestrictedOn(restrictions, activity, onDate);
  const restriction = restrictionFor(restrictions, activity);

  return (
    <>
      {restricted && restriction ? (
        <div
          role="status"
          className="mb-6 flex flex-wrap items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm"
        >
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">{ACTIVITY_LABEL[activity]}</span> is not required for this project from{" "}
            {formatDayMonYear(restriction.not_required_from)}
            {restriction.reason ? ` — ${restriction.reason}` : ""}. Existing records are shown read-only.
          </span>
        </div>
      ) : null}
      <fieldset disabled={restricted} className="m-0 min-w-0 border-0 p-0">
        {children}
      </fieldset>
    </>
  );
}

export function ActivityGate(props: {
  /** Defaults to the route's :projectId. */
  projectId?: string | null;
  activity: ProjectActivity;
  /** Compare with the selected ?period= start date (report-type activities). */
  usePeriodParam?: boolean;
  /** Explicit comparison date (YYYY-MM-DD) — overrides ?period=. */
  periodDate?: string | null;
  children: React.ReactNode;
}) {
  // useSearchParams needs a Suspense boundary at prerender.
  return (
    <Suspense fallback={null}>
      <GateInner {...props} usePeriodParam={props.usePeriodParam ?? false} />
    </Suspense>
  );
}
