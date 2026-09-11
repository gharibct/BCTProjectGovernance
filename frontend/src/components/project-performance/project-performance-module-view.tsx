"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useProject } from "@/lib/api/projects";
import { useAccounts } from "@/lib/api/reference-data";
import { EmptyState } from "@/components/forms/empty-state";

// Shared chrome for the read-only module views launched from the Account
// Head's Project Performance Dashboard (/project-performance/[projectId]) —
// Measurement / Contractual Compliance / RAIDO. No edit affordances and no
// PM reporting nav rail; the only navigation is a "Back to Project
// Performance Dashboard" link. Mirrors de-approval's GovernanceModuleView,
// reusing its module-view components (they're generic, keyed off the
// projectId route param), just backed by the plain project record instead
// of the DE review detail.
export function ProjectPerformanceModuleView({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;
  const { data: project, isLoading } = useProject(projectId);
  const { data: accounts = [] } = useAccounts();
  const accountName = accounts.find((a) => a.id === project?.account_id)?.name;

  if (!projectId) return <EmptyState>No project selected.</EmptyState>;

  const backLink = (
    <Link
      href={`/project-performance/${projectId}`}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4]"
    >
      <ArrowLeft className="size-4" />
      Back to Project Performance Dashboard
    </Link>
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        {backLink}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {title}
          {project ? ` — ${project.project_name}` : ""}
        </h1>
        {project ? (
          <p className="mt-1 text-sm text-slate-500">
            {project.project_code}
            {accountName ? ` · ${accountName}` : ""}
          </p>
        ) : null}
      </div>

      {isLoading && !project ? <p className="text-slate-400">Loading…</p> : children}
    </div>
  );
}
