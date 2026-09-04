"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { effectiveProjectStatus, useProject } from "@/lib/api/projects";
import { useAccounts, useGeos, useRegions, useUsers } from "@/lib/api/reference-data";
import { formatGeoRegion } from "@/lib/api/project-health-lists";
import { EmptyState } from "@/components/forms/empty-state";
import { StatusBadge } from "@/components/forms/status-badge";
import { HealthDot } from "@/components/de-assessment-workspace/shared";
import { ProjectProfileView } from "@/components/de-approval/module-views/project-profile-view";
import { ScopeScheduleView } from "@/components/de-approval/module-views/scope-schedule-view";
import { OracleMappingView } from "@/components/de-approval/module-views/oracle-mapping-view";
import { ContractualView } from "@/components/de-approval/module-views/contractual-view";
import { RaidoView } from "@/components/de-approval/module-views/raido-view";
import { MeasurementView } from "@/components/de-approval/module-views/measurement-view";
import { DE_PROJECT_MODULES, DeProjectNav, type DeProjectModule } from "./de-project-nav";

function ContextItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">{label}</span>
      <span className="mt-1 block text-sm font-medium text-slate-800">{children}</span>
    </div>
  );
}

function moduleContent(active: DeProjectModule) {
  switch (active) {
    case "scope":
      return <ScopeScheduleView />;
    case "oracle":
      return <OracleMappingView />;
    case "contractual":
      return <ContractualView />;
    case "raido":
      return <RaidoView />;
    case "measurement":
      return <MeasurementView />;
    default:
      return <ProjectProfileView />;
  }
}

function DetailInner() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;

  const rawModule = useSearchParams().get("module");
  const activeModule: DeProjectModule = DE_PROJECT_MODULES.some((m) => m.key === rawModule)
    ? (rawModule as DeProjectModule)
    : "profile";

  const { data: project, isLoading } = useProject(projectId);
  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();
  const { data: regions = [] } = useRegions();
  const { data: users = [] } = useUsers();

  const backLink = (
    <Link
      href="/de-projects"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4]"
    >
      <ArrowLeft className="size-4" />
      Back to Projects
    </Link>
  );

  if (project?.project_status === "Draft") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {backLink}
        <EmptyState>This project is a draft and isn&apos;t available here.</EmptyState>
      </div>
    );
  }

  const accountName = accounts.find((a) => a.id === project?.account_id)?.name ?? "—";
  const geoName = geos.find((g) => g.id === project?.geo_id)?.name ?? null;
  const regionName = regions.find((r) => r.id === project?.region_id)?.name ?? null;
  const pmName = users.find((u) => u.id === project?.project_manager_id)?.full_name ?? "—";
  const deName = users.find((u) => u.id === project?.delivery_excellence_id)?.full_name ?? "—";

  return (
    <div className="mx-auto flex max-w-[1400px] gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div>
          {backLink}
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {project?.project_name ?? (isLoading ? "…" : "Project")}
          </h1>
          {project ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-mono">{project.project_code}</span>
              <span>· {accountName}</span>
              <StatusBadge value={effectiveProjectStatus(project)} />
            </p>
          ) : null}
        </div>

        {project ? (
          <div className="grid grid-cols-2 gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
            <ContextItem label="Geo - Region">{formatGeoRegion(geoName, regionName)}</ContextItem>
            <ContextItem label="Project Manager">{pmName}</ContextItem>
            <ContextItem label="Delivery Excellence">{deName}</ContextItem>
            <ContextItem label="PM Health">
              <span className="inline-flex items-center gap-2">
                <HealthDot health={project.delivery_declared_overall_health} />
                {project.delivery_declared_overall_health ?? "—"}
              </span>
            </ContextItem>
            <ContextItem label="DE Assessed Health">
              <span className="inline-flex items-center gap-2">
                <HealthDot health={project.de_assessed_project_health} />
                {project.de_assessed_project_health ?? "—"}
              </span>
            </ContextItem>
            <ContextItem label="Overall Health">
              <span className="inline-flex items-center gap-2">
                <HealthDot health={project.overall_project_health} />
                {project.overall_project_health ?? "—"}
              </span>
            </ContextItem>
          </div>
        ) : null}

        {moduleContent(activeModule)}
      </div>

      {projectId ? <DeProjectNav projectId={projectId} active={activeModule} /> : null}
    </div>
  );
}

export function DeProjectDetail() {
  return (
    <Suspense fallback={null}>
      <DetailInner />
    </Suspense>
  );
}
