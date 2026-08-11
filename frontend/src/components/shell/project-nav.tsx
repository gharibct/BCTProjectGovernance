"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Circle,
  CircleCheck,
  ClipboardList,
  FileText,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { CURRENT_PERIOD } from "@/components/shell/reporting-period-badge";
import { useReportingPeriods } from "@/lib/api/reference-data";

// Every item is its own route (mirrors New Project's nav) so the browser
// URL, back button, and this nav's active state all agree — no in-page
// section switching. `done` marks whether the task is completed for the
// current reporting period (sample values until there's a backend).
type NavItem = {
  label: string;
  href: string;
  done: boolean;
};

// Every href is relative to the current :projectId route segment (see
// buildGroups) so navigating between tabs stays on the same project.
function buildGroups(base: string): { heading: string; icon: LucideIcon; items: NavItem[] }[] {
  return [
    {
      heading: "Project Charter",
      icon: FileText,
      items: [
        { label: "Project Profile", href: `${base}/project-charter`, done: true },
        {
          label: "Scope and Schedule",
          href: `${base}/project-charter/schedule`,
          done: false,
        },
      ],
    },
    {
      heading: "Project Reporting",
      icon: ClipboardList,
      items: [
        { label: "Project Status", href: `${base}/project-status`, done: true },
        {
          label: "Resource Allocation",
          href: `${base}/resource-allocation`,
          done: false,
        },
        { label: "Measurement", href: `${base}/measurement`, done: false },
        {
          label: "Contractual Compliance",
          href: `${base}/contractual-compliance`,
          done: false,
        },
        { label: "Project RAIDO Register", href: `${base}/raido`, done: false },
      ],
    },
    {
      heading: "Delivery Excellence",
      icon: ShieldCheck,
      items: [
        {
          label: "Self Assessment",
          href: `${base}/project-charter/self-assessment`,
          done: false,
        },
        { label: "DE Assessment", href: `${base}/de-assessment`, done: false },
      ],
    },
    {
      heading: "AI Hub",
      icon: Sparkles,
      // Not a period-completion task like the groups above, so there's no
      // pending/done signal to derive — always shown as done so it never
      // reads as an outstanding checklist item.
      items: [
        { label: "AI Document Processing", href: `${base}/ai-hub/document-processing`, done: true },
      ],
    },
  ];
}

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

// Weekly reports only cover Project Status — the remaining Project
// Reporting tabs and the whole Delivery Excellence group only apply to
// Monthly reporting, so they're hidden while a Weekly period is selected.
function weeklyGroups(groups: ReturnType<typeof buildGroups>) {
  return groups
    .filter((group) => group.heading !== "Delivery Excellence")
    .map((group) => {
      if (group.heading === "Project Reporting") {
        return { ...group, items: group.items.filter((item) => item.label === "Project Status") };
      }
      if (group.heading === "Project Charter") {
        return { ...group, items: group.items.filter((item) => item.label !== "Scope and Schedule") };
      }
      return group;
    });
}

// Forwards the current ?period= (if any) onto every link — so a reporting
// period picked once (e.g. via Project Status) stays attached to the URL as
// the user moves between tabs, ready for any other screen (Resource
// Allocation, RAIDO, Document Processing, ...) to read it the same way
// status-header.tsx does. Split out from ProjectNav because useSearchParams
// requires a Suspense boundary at prerender.
function NavLinks({
  groups,
  pathname,
}: {
  groups: ReturnType<typeof buildGroups>;
  pathname: string;
}) {
  const searchParams = useSearchParams();
  const period = searchParams.get("period");
  const suffix = period ? `?period=${period}` : "";

  const { data: periods = [] } = useReportingPeriods();
  const isWeekly = periods.find((p) => p.id === period)?.period_type === "Weekly";
  const visibleGroups = isWeekly ? weeklyGroups(groups) : groups;

  return (
    <nav className="mt-4 flex flex-col gap-2">
      {visibleGroups.map((group) => (
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
                  href={`${item.href}${suffix}`}
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
  );
}

export function ProjectNav() {
  const pathname = usePathname();
  const { projectId } = useParams<{ projectId: string }>();
  const groups = buildGroups(`/project-reporting/${projectId}`);

  // The hub page (/project-reporting/:projectId) is a menu of cards linking
  // into each reporting area — it isn't itself a Weekly/Monthly reporting
  // screen, so this nav (which tracks period completion for those screens)
  // doesn't apply there.
  const isHub = pathname === `/project-reporting/${projectId}`;
  if (isHub) return null;

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white px-4 py-8">
      <p className="flex items-center gap-2 px-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
        <CalendarDays className="size-4 text-[#1a6fc4]" />
        Period: {CURRENT_PERIOD}
      </p>

      <Suspense fallback={null}>
        <NavLinks groups={groups} pathname={pathname} />
      </Suspense>

      <p className="mt-6 flex flex-col gap-1.5 border-t border-slate-100 px-3 pt-4 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <CircleCheck className="size-3.5 text-emerald-500" />
          Completed this period
        </span>
        <span className="flex items-center gap-2">
          <Circle className="size-3.5 text-slate-300" />
          Pending
        </span>
      </p>
    </aside>
  );
}
