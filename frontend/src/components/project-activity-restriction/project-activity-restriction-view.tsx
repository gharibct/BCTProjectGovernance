"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EmptyState } from "@/components/forms/empty-state";
import { StatusBadge } from "@/components/forms/status-badge";
import { effectiveProjectStatus, useProject } from "@/lib/api/projects";
import { useAccounts } from "@/lib/api/reference-data";
import { selectProjectHref } from "@/lib/project-context-targets";
import { useEffectiveRole } from "@/stores/session";
import { ActivityRestrictionsPanel } from "./activity-restrictions-panel";

// Project Activity Restriction — Delivery Excellence only. Reached from the
// left menu through the Project Context page; switches Delivery Status,
// Project Performance (Metrics / Commitments / Payment Milestones) and DE
// Assessment off for the selected project from a date.
export function ProjectActivityRestrictionView() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;
  const role = useEffectiveRole();
  const { data: project, isLoading } = useProject(projectId);
  const { data: accounts = [] } = useAccounts();

  const back = (
    <Link
      href={selectProjectHref("project-activity-restriction")}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4]"
    >
      <ArrowLeft className="size-4" />
      Back to Projects
    </Link>
  );

  if (role !== "DELIVERY_EXCELLENCE") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Project Activity Restriction</h1>
        <EmptyState>This screen is available to Delivery Excellence only.</EmptyState>
      </div>
    );
  }

  const accountName = accounts.find((a) => a.id === project?.account_id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <div>
        {back}
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Project Activity Restriction</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{project?.project_name ?? (isLoading ? "…" : "Project")}</span>
          {project ? (
            <>
              <span className="font-mono">{project.project_code}</span>
              <span>· {accountName}</span>
              <StatusBadge value={effectiveProjectStatus(project)} />
            </>
          ) : null}
        </p>
      </div>

      {projectId ? <ActivityRestrictionsPanel projectId={projectId} canEdit /> : null}
    </div>
  );
}
