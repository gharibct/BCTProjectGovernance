"use client";

import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

import { StickyActionBar } from "@/components/forms/sticky-action-bar";
import { cn } from "@/lib/utils";
import { useNewProjectId } from "@/stores/new-project-ui";
import { isBaselineEditable, projectScreenRoot, useProject, type Project } from "@/lib/api/projects";

// The single "may this project's baseline be edited?" check for every Project
// Setup / Amend Project baseline screen (Profile, Scope & Schedule, Map Oracle
// Projects, Measurement, Contractual Compliance, AI Document Processing). It
// replaces the old per-form `isAmendableStatus` + "Edit Project" unlock: the only
// statuses that allow edits are Draft and Under Amendment, and the server enforces
// the same rule (422 PROJECT_LOCKED), so this only decides what the UI disables.
//
//   - A not-yet-created draft (no project id in the URL) is editable.
//   - While the project is still loading (or failed to load) it is NOT editable, so
//     the form never flashes enabled and then locks.
export function useBaselineEditable(): {
  projectId: string | null;
  project: Project | undefined;
  editable: boolean;
  isLoading: boolean;
} {
  const projectId = useNewProjectId();
  const { data: project, isLoading } = useProject(projectId);
  const editable = projectId === null ? true : !!project && isBaselineEditable(project.project_status);
  return { projectId, project, editable, isLoading };
}

// Why the baseline is locked and how to get it editable again.
export function baselineLockInfo(project: Project): { message: string; href: string; label: string } {
  if (project.project_status === "Pending Approval") {
    return {
      message: "This project is frozen while it is being reviewed. To make changes, recall the project.",
      href: `/${projectScreenRoot(project)}/${project.id}/send-to-approval`,
      label: "Goto \"Sent to Approval\" to recall →",
    };
  }
  return {
    message: `${project.project_status}: this project's baseline is locked.`,
    href: `/amend-project/${project.id}/initiate-amend`,
    label: "Go to Amendment Request →",
  };
}

export function BaselineLockLink({ project }: { project: Project }) {
  const { href, label } = baselineLockInfo(project);
  return (
    <Link href={href} className="font-semibold text-[#1a6fc4] underline underline-offset-2 hover:text-[#15559a]">
      {label}
    </Link>
  );
}

// Amber bar styling shared by every screen that shows the lock message.
export const LOCK_BAR_CLASS = "border-amber-200 bg-amber-50";

export function BaselineLockMessage({ project }: { project: Project }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-amber-800">
      <Lock className="size-4 shrink-0" />
      {baselineLockInfo(project).message}
    </p>
  );
}

export function BaselineLockNotice({ project }: { project: Project }) {
  // Pinned to the bottom of the screen (z-40 so it sits over a form's own,
  // disabled, action bar rather than stacking beside it).
  return (
    <StickyActionBar className={cn("z-40", LOCK_BAR_CLASS)} secondary={<BaselineLockMessage project={project} />}>
      <BaselineLockLink project={project} />
    </StickyActionBar>
  );
}

// Wraps a baseline screen: shows the lock notice and, when the baseline isn't
// editable, disables every native control inside (a disabled <fieldset> disables
// all descendant inputs / selects / textareas / buttons). Links stay clickable.
export function BaselineGate({ children }: { children: React.ReactNode }) {
  const { project, editable } = useBaselineEditable();
  return (
    <>
      {!editable && project ? <BaselineLockNotice project={project} /> : null}
      <fieldset disabled={!editable} className="m-0 min-w-0 border-0 p-0">
        {children}
      </fieldset>
    </>
  );
}
