"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumn,
  ChevronDown,
  FolderOpen,
  LayoutGrid,
  Plus,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { NEW_PROJECT_SEGMENT } from "@/stores/new-project-ui";
import { useProjects, type Project } from "@/lib/api/projects";

const itemClass =
  "flex items-center gap-3.5 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors";
const activeClass = "bg-[#3f8ce0]";
const idleClass = "hover:bg-white/10";

function CollapsibleGroup({
  icon: Icon,
  label,
  active,
  children,
  defaultOpen,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  children: React.ReactNode;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(itemClass, "w-full justify-between", active ? activeClass : idleClass)}
      >
        <span className="flex items-center gap-3.5">
          <Icon className="size-5 shrink-0" />
          {label}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="mt-1 mb-1 ml-6 flex flex-col gap-0.5 border-l border-white/15 pl-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

// A project counts as "Approved" once it's past Pending Approval — Draft and
// Pending Approval are still being set up (Maintain Project); Approved
// onward (Approved/Hold/Closed/Open Only for Billing) is what charter-form's
// Approve button produces and is what Project Reporting reports on.
function isApproved(status: Project["project_status"]): boolean {
  return status !== "Draft" && status !== "Pending Approval";
}

export function AppSidebar() {
  const pathname = usePathname();

  const { data: projects = [] } = useProjects();
  const maintainProjects = projects.filter((p) => !isApproved(p.project_status));
  const reportingProjects = projects.filter((p) => isApproved(p.project_status));

  const isDashboard = pathname === "/dashboard";
  const isNewProject = pathname.startsWith("/new-project");
  const isProjectReporting = pathname.startsWith("/project-reporting");
  // The :projectId route segment is the single source of truth for which of
  // "New Project" (segment === "new") vs "Maintain Project" (a real id) is
  // active — no separate client-side intent flag to keep in sync.
  const routeProjectId = isNewProject ? pathname.split("/")[2] : undefined;
  const isMaintaining = isNewProject && routeProjectId !== NEW_PROJECT_SEGMENT;
  // /project-reporting/{projectId}(/...) — every project-reporting route is
  // nested under a :projectId segment, including the hub page itself.
  const reportingProjectId = isProjectReporting ? pathname.split("/")[2] : undefined;

  return (
    <aside className="w-64 shrink-0 bg-[#1a4a7a] py-6">
      <nav className="flex flex-col gap-2 px-3">
        <Link
          href="/dashboard"
          aria-current={isDashboard ? "page" : undefined}
          className={cn(itemClass, isDashboard ? activeClass : idleClass)}
        >
          <LayoutGrid className="size-5 shrink-0" />
          Dashboard
        </Link>

        <Link
          href="/new-project/new/project-charter"
          aria-current={isNewProject && !isMaintaining ? "page" : undefined}
          className={cn(itemClass, isNewProject && !isMaintaining ? activeClass : idleClass)}
        >
          <Plus className="size-5 shrink-0" />
          New Project
        </Link>

        <CollapsibleGroup
          icon={Wrench}
          label="Maintain Project"
          active={isMaintaining}
          defaultOpen={isMaintaining}
        >
          {maintainProjects.map((project) => {
            const active = isMaintaining && project.id === routeProjectId;
            const href = `/new-project/${project.id}/project-charter`;
            return (
              <Link
                key={project.id}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block w-full rounded-md px-3 py-2 text-left font-mono text-[13px] transition-colors",
                  active
                    ? "bg-white/15 font-semibold text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                {project.project_code}
              </Link>
            );
          })}
          {maintainProjects.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-slate-400">No projects yet.</p>
          ) : null}
        </CollapsibleGroup>

        <CollapsibleGroup
          icon={FolderOpen}
          label="Project Reporting"
          active={isProjectReporting}
          defaultOpen={isProjectReporting}
        >
          {reportingProjects.map((project) => {
            const active = project.id === reportingProjectId;
            const href = `/project-reporting/${project.id}`;
            return (
              <Link
                key={project.id}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block w-full rounded-md px-3 py-2 text-left font-mono text-[13px] transition-colors",
                  active
                    ? "bg-white/15 font-semibold text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                {project.project_code}
              </Link>
            );
          })}
          {reportingProjects.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-slate-400">No approved projects yet.</p>
          ) : null}
        </CollapsibleGroup>

        <Link href="#" className={cn(itemClass, idleClass)}>
          <ChartColumn className="size-5 shrink-0" />
          System Health
        </Link>
      </nav>
    </aside>
  );
}
