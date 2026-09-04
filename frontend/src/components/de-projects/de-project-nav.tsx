"use client";

import Link from "next/link";
import { ClipboardList, FileText, NotebookText, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export const DE_PROJECT_MODULES = [
  { key: "oracle", label: "Map Oracle Projects" },
  { key: "profile", label: "Project Profile" },
  { key: "scope", label: "Scope & Schedule" },
  { key: "measurement", label: "Measurement" },
  { key: "contractual", label: "Contractual Compliance" },
  { key: "raido", label: "RAIDO Register" },
] as const;

export type DeProjectModule = (typeof DE_PROJECT_MODULES)[number]["key"];

// Grouped like the New Project charter rail (new-project-nav.tsx).
const GROUPS: { heading: string; icon: LucideIcon; keys: DeProjectModule[] }[] = [
  { heading: "Project Charter", icon: FileText, keys: ["oracle", "profile", "scope"] },
  { heading: "Project Baseline", icon: ClipboardList, keys: ["measurement", "contractual"] },
  { heading: "Project Register", icon: NotebookText, keys: ["raido"] },
];

const LABELS: Record<DeProjectModule, string> = Object.fromEntries(
  DE_PROJECT_MODULES.map((m) => [m.key, m.label])
) as Record<DeProjectModule, string>;

const childClass =
  "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors";
const activeClass = "bg-[#d9eafc] font-bold text-[#15406b]";
const idleClass = "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900";

// Right-hand module menu for the read-only DE project detail — mirrors the
// New Project charter rail's grouped headings + bordered sub-lists.
export function DeProjectNav({
  projectId,
  active,
}: {
  projectId: string;
  active: DeProjectModule;
}) {
  return (
    <aside className="w-64 shrink-0 border-l border-slate-200 pl-4">
      <nav className="flex flex-col gap-2">
        {GROUPS.map((group) => (
          <div key={group.heading}>
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-bold text-slate-800">
              <group.icon className="size-5 shrink-0 text-[#1a6fc4]" />
              {group.heading}
            </div>
            <div className="mt-1 mb-1 ml-5 flex flex-col gap-0.5 border-l border-slate-200 pl-3">
              {group.keys.map((key) => (
                <Link
                  key={key}
                  href={`/de-projects/${projectId}?module=${key}`}
                  aria-current={active === key ? "page" : undefined}
                  className={cn(childClass, active === key ? activeClass : idleClass)}
                >
                  {LABELS[key]}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
