"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Circle,
  CircleCheck,
  ClipboardList,
  FileText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { CURRENT_PERIOD } from "@/components/shell/reporting-period-badge";

// Copy of the project navigation rail scoped to the New Project screens.
// Every item is its own route so the browser URL, back button, and this
// nav's active state all agree — no in-page tab switching. `done` marks
// whether the task is completed for the current reporting period (sample
// values until there's a backend).
type NavItem = {
  label: string;
  href: string;
  done: boolean;
};

const GROUPS: { heading: string; icon: LucideIcon; items: NavItem[] }[] = [
  {
    heading: "Project Charter",
    icon: FileText,
    items: [
      { label: "Project Profile", href: "/new-project/project-charter", done: true },
      {
        label: "Scope & Schedule",
        href: "/new-project/project-charter/schedule",
        done: false,
      },
      {
        label: "Map Oracle Projects",
        href: "/new-project/map-oracle-projects",
        done: false,
      },
    ],
  },
  {
    heading: "Project Baseline",
    icon: ClipboardList,
    items: [
      { label: "Measurement", href: "/new-project/measurement", done: false },
      {
        label: "Contractual Compliance",
        href: "/new-project/contractual-compliance",
        done: false,
      },
      { label: "Project RAIDO Register", href: "/new-project/raido", done: false },
    ],
  },
  {
    heading: "Baseline Assessment",
    icon: ShieldCheck,
    items: [
      {
        label: "Self Assessment",
        href: "/new-project/project-charter/self-assessment",
        done: false,
      },
      { label: "DE Assessment", href: "/new-project/de-assessment", done: false },
    ],
  },
];

const childClass =
  "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors";
const activeClass = "bg-[#d9eafc] font-bold text-[#15406b]";
const idleClass = "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900";

function StatusIcon({ done }: { done: boolean }) {
  const title = done
    ? `Completed for ${CURRENT_PERIOD}`
    : `Pending for ${CURRENT_PERIOD}`;
  return done ? (
    <CircleCheck className="size-4 shrink-0 text-emerald-500">
      <title>{title}</title>
    </CircleCheck>
  ) : (
    <Circle className="size-4 shrink-0 text-slate-300">
      <title>{title}</title>
    </Circle>
  );
}

export function NewProjectNav() {
  const pathname = usePathname();

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white px-4 py-8">
      <nav className="flex flex-col gap-2">
        {GROUPS.map((group) => (
          <div key={group.heading}>
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-bold text-slate-800">
              <group.icon className="size-5 shrink-0 text-[#1a6fc4]" />
              {group.heading}
            </div>
            <div className="mt-1 mb-1 ml-5 flex flex-col gap-0.5 border-l border-slate-200 pl-3">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(childClass, active ? activeClass : idleClass)}
                  >
                    {item.label}
                    <StatusIcon done={item.done} />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <p className="mt-6 flex flex-col gap-1.5 border-t border-slate-100 px-3 pt-4 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <CircleCheck className="size-3.5 text-emerald-500" />
          Completed
        </span>
        <span className="flex items-center gap-2">
          <Circle className="size-3.5 text-slate-300" />
          Pending
        </span>
      </p>
    </aside>
  );
}
