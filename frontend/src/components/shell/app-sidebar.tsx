import Link from "next/link";
import {
  ChartColumn,
  FolderOpen,
  LayoutGrid,
  Plus,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Projects visible to the signed-in user — sample data until there's a
// backend; only PRJ-2026-0042 has screens built.
const PROJECTS = [
  { id: "PRJ-2026-0042", href: "/project-reporting" },
  { id: "PRJ-2026-0038", href: "#" },
  { id: "PRJ-2026-0031", href: "#" },
  { id: "PRJ-2025-0117", href: "#" },
];

const ACTIVE_PROJECT = "PRJ-2026-0042";

const itemClass =
  "flex items-center gap-3.5 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors";

export function AppSidebar() {
  return (
    <aside className="w-64 shrink-0 bg-[#1a4a7a] py-6">
      <nav className="flex flex-col gap-2 px-3">
        <Link href="/dashboard" className={cn(itemClass, "hover:bg-white/10")}>
          <LayoutGrid className="size-5 shrink-0" />
          Dashboard
        </Link>

        <Link
          href="/new-project/project-charter"
          className={cn(itemClass, "hover:bg-white/10")}
        >
          <Plus className="size-5 shrink-0" />
          New Project
        </Link>

        <div>
          <div className={cn(itemClass, "bg-[#3f8ce0]")}>
            <FolderOpen className="size-5 shrink-0" />
            Project Reporting
          </div>
          <div className="mt-1 mb-1 ml-6 flex flex-col gap-0.5 border-l border-white/15 pl-3">
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
          </div>
        </div>

        <Link href="#" className={cn(itemClass, "hover:bg-white/10")}>
          <ChartColumn className="size-5 shrink-0" />
          System Health
        </Link>
      </nav>
    </aside>
  );
}
