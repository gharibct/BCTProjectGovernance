"use client";

import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

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
      message: "With Delivery Excellence: this project is frozen while it is being reviewed.",
      href: `/${projectScreenRoot(project)}/${project.id}/send-to-approval`,
      label: "Recall it to make changes",
    };
  }
  return {
    message: `${project.project_status}: this project's baseline is locked.`,
    href: `/amend-project/${project.id}/initiate-amend`,
    label: "Initiate an amendment to edit",
  };
}

export function BaselineLockLink({ project }: { project: Project }) {
  const { href, label } = baselineLockInfo(project);
  return (
    <Link href={href} className="font-semibold text-[#1a6fc4] hover:underline">
      {label}
    </Link>
  );
}

export function BaselineLockNotice({ project }: { project: Project }) {
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <Lock className="size-4 shrink-0" />
      <span>{baselineLockInfo(project).message}</span>
      <BaselineLockLink project={project} />
    </div>
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
