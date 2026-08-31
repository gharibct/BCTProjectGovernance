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
  LayoutGrid,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { CURRENT_PERIOD } from "@/components/shell/reporting-period-badge";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { activeClass, childClass, idleClass, StatusIcon, type NavGroup } from "./nav-primitives";

// Every href is relative to the current :projectId route segment (see
// buildGroups) so navigating between tabs stays on the same project.
function buildGroups(base: string): NavGroup[] {
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
      heading: "Report Project",
      icon: ClipboardList,
      items: [
        { label: "Project Status", href: `${base}/project-status`, done: true },
        {
          label: "RAG Status",
          href: `${base}/project-charter/self-assessment`,
          done: false,
        },
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
        { label: "Document Processing", href: `${base}/ai-hub/document-processing`, done: true },
      ],
    },
  ];
}

// Each period type reports on only a slice of buildGroups(). Weekly covers
// Project Status and RAG Status; Monthly covers the three baseline registers
// (Measurement, Contractual Compliance, RAIDO). Neither touches the Project
// Charter or Delivery Excellence groups, so both are dropped; the standalone
// Project Dashboard link and the AI Hub group stay in both.
function weeklyGroups(groups: NavGroup[]): NavGroup[] {
  return groups
    .filter(
      (group) => group.heading !== "Delivery Excellence" && group.heading !== "Project Charter",
    )
    .map((group) =>
      group.heading === "Report Project"
        ? {
            ...group,
            items: group.items.filter(
              (item) => item.label === "Project Status" || item.label === "RAG Status",
            ),
          }
        : group,
    );
}

const MONTHLY_REPORTING_ITEMS = new Set([
  "Measurement",
  "Contractual Compliance",
  "Project RAIDO Register",
]);

function monthlyGroups(groups: NavGroup[]): NavGroup[] {
  return groups
    .filter(
      (group) => group.heading !== "Delivery Excellence" && group.heading !== "Project Charter",
    )
    .map((group) =>
      group.heading === "Report Project"
        ? { ...group, items: group.items.filter((item) => MONTHLY_REPORTING_ITEMS.has(item.label)) }
        : group,
    );
}

// Forwards the current ?period= (if any) onto every link — so a reporting
// period picked once (e.g. via Project Status) stays attached to the URL as
// the user moves between tabs, ready for any other screen (Resource
// Allocation, RAIDO, Document Processing, ...) to read it the same way
// project-header.tsx does. Split out from ProjectNav because useSearchParams
// requires a Suspense boundary at prerender.
function NavLinks({ groups, pathname, base }: { groups: NavGroup[]; pathname: string; base: string }) {
  const searchParams = useSearchParams();
  const period = searchParams.get("period");
  const suffix = period ? `?period=${period}` : "";

  const { data: periods = [] } = useReportingPeriods();
  const isWeekly = periods.find((p) => p.id === period)?.period_type === "Weekly";
  const visibleGroups = isWeekly ? weeklyGroups(groups) : monthlyGroups(groups);

  // Standalone entry (not part of a heading+items group like the ones
  // below) — the Project Manager's read-first counterpart to the Account
  // Manager's Project Review screen, always available regardless of the
  // Weekly/Monthly filtering that only applies to the reporting checklist.
  const dashboardHref = `${base}/dashboard`;
  const dashboardActive = pathname === dashboardHref;

  return (
    <nav className="mt-4 flex flex-col gap-2">
      <Link
        href={`${dashboardHref}${suffix}`}
        aria-current={dashboardActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-bold transition-colors",
          dashboardActive ? "bg-[#d9eafc] text-[#15406b]" : "text-slate-800 hover:bg-slate-100"
        )}
      >
        <LayoutGrid className="size-5 shrink-0 text-[#1a6fc4]" />
        Project Dashboard
      </Link>

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
  const base = `/project-reporting/${projectId}`;
  const groups = buildGroups(base);

  // The hub page (/project-reporting/:projectId) is a menu of cards linking
  // into each reporting area — it isn't itself a Weekly/Monthly reporting
  // screen, so this nav (which tracks period completion for those screens)
  // doesn't apply there.
  const isHub = pathname === base;
  if (isHub) return null;

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white px-4 py-8">
      <p className="flex items-center gap-2 px-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
        <CalendarDays className="size-4 text-[#1a6fc4]" />
        Period: {CURRENT_PERIOD}
      </p>

      <Suspense fallback={null}>
        <NavLinks groups={groups} pathname={pathname} base={base} />
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
