import { projectScreenRoot, type Project } from "@/lib/api/projects";
import type { MenuEntryId } from "@/lib/menu-config";

// Project-level menu entries. Clicking one no longer expands a project list in
// the sidebar — it opens the Project Context page (/select-project/{entry}),
// which picks a project and then forwards to that entry's own screen.

export type ProjectTargetId = Extract<
  MenuEntryId,
  | "maintain-project"
  | "view-amend-projects"
  | "delivery-reporting"
  | "performance-reporting"
  | "project-review"
  | "project-performance"
  | "de-assessment-report"
>;

// A project counts as "Approved" once it's past Pending Approval — Draft and
// Pending Approval are still being set up (Project Setup); Approved onward is
// what the DE Project Approval screen produces and what Amend Project /
// the review screens operate on.
export function isApproved(status: Project["project_status"]): boolean {
  return status !== "Draft" && status !== "Pending Approval";
}

// Report Delivery Status / Report Project Performance are narrower than isApproved: a project mid-revision
// (Under Amendment) is back in the charter-editing flow, not a live project to
// report on, so it's excluded there (it still shows under Amend Project).
export function canReport(status: Project["project_status"]): boolean {
  return isApproved(status) && status !== "Under Amendment";
}

type ProjectTarget = {
  /** Screen name shown on the Context page ("Continue to …"). */
  label: string;
  /** Where the selected project's screen lives. */
  hrefFor: (projectId: string) => string;
  /** Which projects this screen can operate on. */
  eligible: (project: Project) => boolean;
  /** Message when there is nothing to pick. */
  emptyLabel: string;
};

export const PROJECT_TARGETS: Record<ProjectTargetId, ProjectTarget> = {
  // Project Setup vs Amend Project is decided by projectScreenRoot, not by
  // isApproved alone: a Pending Approval project belongs to Amend Project when an
  // amendment was submitted (so it stays with the screen the PM amended it on).
  "maintain-project": {
    label: "Project Setup",
    hrefFor: (id) => `/new-project/${id}/project-charter`,
    eligible: (p) => projectScreenRoot(p) === "new-project",
    emptyLabel: "No projects awaiting setup.",
  },
  "view-amend-projects": {
    label: "Amend Project",
    hrefFor: (id) => `/amend-project/${id}/project-charter`,
    eligible: (p) => projectScreenRoot(p) === "amend-project",
    emptyLabel: "No approved projects yet.",
  },
  "delivery-reporting": {
    label: "Report Delivery Status",
    hrefFor: (id) => `/project-reporting/${id}/delivery-calendar`,
    eligible: (p) => canReport(p.project_status),
    emptyLabel: "No approved projects yet.",
  },
  "performance-reporting": {
    label: "Report Project Performance",
    hrefFor: (id) => `/project-reporting/${id}/performance`,
    eligible: (p) => canReport(p.project_status),
    emptyLabel: "No approved projects yet.",
  },
  "project-review": {
    label: "Project Delivery Status",
    hrefFor: (id) => `/project-review/${id}`,
    eligible: (p) => isApproved(p.project_status),
    emptyLabel: "No projects to review yet.",
  },
  "project-performance": {
    label: "Project Performance",
    hrefFor: (id) => `/project-performance/${id}`,
    eligible: (p) => isApproved(p.project_status),
    emptyLabel: "No projects yet.",
  },
  "de-assessment-report": {
    label: "DE Assessment",
    hrefFor: (id) => `/de-assessment/${id}`,
    eligible: (p) => canReport(p.project_status),
    emptyLabel: "No approved projects yet.",
  },
};

export function isProjectTargetId(value: string): value is ProjectTargetId {
  return Object.prototype.hasOwnProperty.call(PROJECT_TARGETS, value);
}

export function selectProjectHref(target: ProjectTargetId): string {
  return `/select-project/${target}`;
}
