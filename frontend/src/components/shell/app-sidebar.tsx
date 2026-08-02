"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartColumn,
  ChevronDown,
  FolderOpen,
  LayoutGrid,
  Plus,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useNewProjectUi } from "@/stores/new-project-ui";
import { useProjectRegistry, type ProjectRecord } from "@/stores/project-registry";

// Projects visible to the signed-in user — sample data until there's a
// backend; only PRJ-2026-0042 has screens built.
const PROJECTS = [
  { id: "PRJ-2026-0042", href: "/project-reporting" },
  { id: "PRJ-2026-0038", href: "#" },
  { id: "PRJ-2026-0031", href: "#" },
  { id: "PRJ-2025-0117", href: "#" },
];

const ACTIVE_PROJECT = "PRJ-2026-0042";

// Original (non-New Project) project screens, so the "Project Reporting"
// group highlights only for those routes rather than always being on.
const PROJECT_REPORTING_PREFIXES = [
  "/project-reporting",
  "/project-charter",
  "/project-status",
  "/measurement",
  "/de-assessment",
  "/contractual-compliance",
  "/raido",
];

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

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const projects = useProjectRegistry((state) => state.projects);
  const currentProjectCode = useNewProjectUi((state) => state.projectCode);
  const setProjectCode = useNewProjectUi((state) => state.setProjectCode);
  const setProjectName = useNewProjectUi((state) => state.setProjectName);
  const resetDraft = useNewProjectUi((state) => state.resetDraft);

  const isDashboard = pathname === "/dashboard";
  const isNewProject = pathname.startsWith("/new-project");
  const isProjectReporting = PROJECT_REPORTING_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  // Distinguishes "creating a new project" from "reopened via Maintain
  // Project" — both live at the same route, so the signal is whether the
  // project currently loaded in the shared store is a registered one.
  const isMaintaining =
    isNewProject && projects.some((p) => p.code === currentProjectCode);

  // Reopening a project only rehydrates its identity (code/name) — every
  // other field on the charter screens is local component state today and
  // resets to its default. See stores/project-registry.ts.
  const openForMaintenance = (project: ProjectRecord) => {
    setProjectCode(project.code);
    setProjectName(project.name);
    router.push("/new-project/project-charter");
  };

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
          href="/new-project/project-charter"
          aria-current={isNewProject ? "page" : undefined}
          onClick={() => {
            if (isMaintaining) resetDraft();
          }}
          className={cn(itemClass, isNewProject ? activeClass : idleClass)}
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
          {projects.map((project) => {
            const active = isNewProject && project.code === currentProjectCode;
            return (
              <button
                key={project.code}
                type="button"
                onClick={() => openForMaintenance(project)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left font-mono text-[13px] transition-colors",
                  active
                    ? "bg-white/15 font-semibold text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                {project.code}
              </button>
            );
          })}
        </CollapsibleGroup>

        <CollapsibleGroup
          icon={FolderOpen}
          label="Project Reporting"
          active={isProjectReporting}
          defaultOpen={isProjectReporting}
        >
          {PROJECTS.map((project) => {
            const active = project.id === ACTIVE_PROJECT;
            return (
              <Link
                key={project.id}
                href={project.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 font-mono text-[13px] transition-colors",
                  active
                    ? "bg-white/15 font-semibold text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                {project.id}
              </Link>
            );
          })}
        </CollapsibleGroup>

        <Link href="#" className={cn(itemClass, idleClass)}>
          <ChartColumn className="size-5 shrink-0" />
          System Health
        </Link>
      </nav>
    </aside>
  );
}
