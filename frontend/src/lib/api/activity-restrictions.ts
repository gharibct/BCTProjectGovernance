import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

// Per-project activity restrictions (backend: endpoints/project_activity_restrictions.py).
// From `not_required_from` a project no longer owes — or accepts — the activity.
// Report-type activities apply to reporting periods that START on/after the date;
// DE Assessment (and DE Findings) to assessments / findings dated on/after it.
// Admin and Delivery Excellence set or lift one; there is at most one per
// (project, activity). Records that already exist stay visible, read-only.

export type ProjectActivity =
  | "DELIVERY_STATUS"
  | "METRICS"
  | "COMMITMENTS"
  | "PAYMENT_MILESTONES"
  | "DE_ASSESSMENT";

export const PROJECT_ACTIVITIES: { key: ProjectActivity; label: string; hint: string }[] = [
  { key: "DELIVERY_STATUS", label: "Delivery Status Reporting", hint: "Weekly Delivery Status report and RAG" },
  { key: "METRICS", label: "Project Performance - Metrics", hint: "Monthly measurement" },
  { key: "COMMITMENTS", label: "Project Performance - Contractual Commitments", hint: "Monthly commitment actuals" },
  { key: "PAYMENT_MILESTONES", label: "Project Performance - Payment Milestones", hint: "Milestone payment actuals" },
  { key: "DE_ASSESSMENT", label: "DE Assessment", hint: "Assessments and DE findings" },
];

export const ACTIVITY_LABEL: Record<ProjectActivity, string> = Object.fromEntries(
  PROJECT_ACTIVITIES.map((a) => [a.key, a.label]),
) as Record<ProjectActivity, string>;

export type ActivityRestriction = {
  id: string;
  project_id: string;
  activity: ProjectActivity;
  not_required_from: string; // YYYY-MM-DD
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

// Every project's restrictions (small table) — the project pickers use it to leave a
// project out of a screen whose activity is switched off for it.
export function useAllActivityRestrictions() {
  return useQuery({
    queryKey: ["activity-restrictions", "all"],
    queryFn: () => api.get<ActivityRestriction[]>("/activity-restrictions"),
  });
}

/** True when EVERY activity in `activities` is restricted for the project today. */
export function projectActivitiesRestricted(
  all: ActivityRestriction[] | undefined,
  projectId: string,
  activities: ProjectActivity[],
): boolean {
  if (!all || activities.length === 0) return false;
  const mine = all.filter((r) => r.project_id === projectId);
  return activities.every((a) => isRestrictedOn(mine, a));
}

export function useProjectRestrictions(projectId: string | null) {
  return useQuery({
    queryKey: ["activity-restrictions", projectId],
    queryFn: () => api.get<ActivityRestriction[]>(`/projects/${projectId}/activity-restrictions`),
    enabled: !!projectId,
  });
}

// A restriction changes what is owed, so every screen derived from the
// reporting calendars, completion checklists and dashboards is refreshed.
function useInvalidate(projectId: string | null) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["activity-restrictions", projectId] });
    queryClient.invalidateQueries({ queryKey: ["activity-restrictions", "all"] });
    queryClient.invalidateQueries({ queryKey: ["reporting-activity"] });
    queryClient.invalidateQueries({ queryKey: ["monthly-completion"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-de-summary"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-project-health"] });
  };
}

export function useSetActivityRestriction(projectId: string | null) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: ({
      activity,
      not_required_from,
      reason,
    }: {
      activity: ProjectActivity;
      not_required_from: string;
      reason?: string;
    }) =>
      api.put<ActivityRestriction>(`/projects/${projectId}/activity-restrictions/${activity}`, {
        not_required_from,
        reason: reason?.trim() || null,
      }),
    onSuccess: invalidate,
  });
}

export function useLiftActivityRestriction(projectId: string | null) {
  const invalidate = useInvalidate(projectId);
  return useMutation({
    mutationFn: (activity: ProjectActivity) =>
      api.delete(`/projects/${projectId}/activity-restrictions/${activity}`),
    onSuccess: invalidate,
  });
}

export function restrictionFor(
  restrictions: ActivityRestriction[] | undefined,
  activity: ProjectActivity,
): ActivityRestriction | undefined {
  return restrictions?.find((r) => r.activity === activity);
}

function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** True when `activity` is no longer required on `onDate` (default today). Dates are YYYY-MM-DD. */
export function isRestrictedOn(
  restrictions: ActivityRestriction[] | undefined,
  activity: ProjectActivity,
  onDate?: string | null,
): boolean {
  const restriction = restrictionFor(restrictions, activity);
  return !!restriction && (onDate ?? todayISO()) >= restriction.not_required_from;
}
