"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import {
  Circle,
  CircleCheck,
  ClipboardList,
  FileText,
  Send,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ProgressHeader } from "@/components/shell/progress-header";
import { ProjectReportRail } from "@/components/project-status/project-report-rail";
import { useReportingPeriods } from "@/lib/api/reference-data";
import {
  useMonthlyCompletion,
  type ReportPageType,
} from "@/lib/api/reporting-attestation";
import {
  activeClass,
  childClass,
  idleClass,
  StatusIcon,
  type NavGroup,
} from "./nav-primitives";

// Every href is relative to the current :projectId route segment (see
// buildGroups) so navigating between tabs stays on the same project.
function buildGroups(base: string): NavGroup[] {
  return [
    {
      heading: "Project Charter",
      icon: FileText,
      items: [
        {
          label: "Project Profile",
          href: `${base}/project-charter`,
          done: true,
        },
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
          label: "Resource Allocation",
          href: `${base}/resource-allocation`,
          done: false,
        },
        { label: "Measurement", href: `${base}/measurement`, done: false },
        {
          label: "Contractual Commitments",
          href: `${base}/contractual-commitments`,
          done: false,
        },
        { label: "Payment Milestones", href: `${base}/milestones`, done: false },
        { label: "Project RAIDO Register", href: `${base}/raido`, done: false },
      ],
    },
  ];
}

// Each period type reports on only a slice of buildGroups(). Weekly covers
// Project Status and RAG Status; Monthly covers the three baseline registers
// (Measurement, Contractual Commitments, Milestones, RAIDO). Neither touches the Project
// Charter group, so it's dropped; the standalone Delivery Status Report -
// Project link and the AI Hub group stay in both. (DE Assessment is not
// part of project reporting — it lives at the top-level /de-assessment.)
function weeklyGroups(groups: NavGroup[]): NavGroup[] {
  return groups
    .filter((group) => group.heading !== "Project Charter")
    .map((group) =>
      group.heading === "Report Project"
        ? {
            ...group,
            items: group.items.filter(
              (item) => item.label === "Project Status",
            ),
          }
        : group,
    );
}

const MONTHLY_REPORTING_ITEMS = new Set([
  "Measurement",
  "Contractual Commitments",
  "Payment Milestones",
  "Project RAIDO Register",
]);

function monthlyGroups(groups: NavGroup[]): NavGroup[] {
  return groups
    .filter((group) => group.heading !== "Project Charter")
    .map((group) =>
      group.heading === "Report Project"
        ? {
            ...group,
            items: group.items.filter((item) =>
              MONTHLY_REPORTING_ITEMS.has(item.label),
            ),
          }
        : group,
    );
}

// Forwards the current ?period= (if any) onto every link — so a reporting
// period picked once (e.g. via Project Status) stays attached to the URL as
// the user moves between tabs, ready for any other screen (Resource
// Allocation, RAIDO, Document Processing, ...) to read it the same way
// project-header.tsx does. Split out from ProjectNav because useSearchParams
// requires a Suspense boundary at prerender.
// Nav item -> the monthly completion sections that must all be complete for
// its tick to turn green (RAIDO spans its five logs).
const MONTHLY_ITEM_SECTIONS: Record<string, ReportPageType[]> = {
  Measurement: ["MEASUREMENT"],
  "Contractual Commitments": ["COMMITMENTS"],
  "Payment Milestones": ["PAYMENT_MILESTONES"],
  "Project RAIDO Register": [
    "RISK",
    "ASSUMPTION",
    "ISSUE",
    "DEPENDENCY",
    "OPPORTUNITY",
  ],
};

const RAIDO_LOGS: { key: string; label: string; section: ReportPageType }[] = [
  { key: "risk", label: "Risk", section: "RISK" },
  { key: "assumption", label: "Assumption", section: "ASSUMPTION" },
  { key: "issue", label: "Issue", section: "ISSUE" },
  { key: "dependency", label: "Dependency", section: "DEPENDENCY" },
  { key: "opportunity", label: "Opportunity", section: "OPPORTUNITY" },
];

function NavLinks({
  groups,
  pathname,
  base,
}: {
  groups: NavGroup[];
  pathname: string;
  base: string;
}) {
  const searchParams = useSearchParams();
  const period = searchParams.get("period");
  const suffix = period ? `?period=${period}` : "";

  const { data: periods = [] } = useReportingPeriods();
  const isWeekly =
    periods.find((p) => p.id === period)?.period_type === "Weekly";
  const visibleGroups = isWeekly ? weeklyGroups(groups) : monthlyGroups(groups);

  const { projectId } = useParams<{ projectId: string }>();
  const isMonthly =
    periods.find((p) => p.id === period)?.period_type === "Monthly";
  const { data: completion } = useMonthlyCompletion(
    projectId,
    isMonthly ? period : null,
  );
  const isDone = (item: { label: string; done: boolean }) => {
    const sections = MONTHLY_ITEM_SECTIONS[item.label];
    if (!isMonthly || !sections) return item.done;
    return sections.every(
      (s) => completion?.find((c) => c.page_type === s)?.complete,
    );
  };

  // Preview / submit entry, pinned below the checklist groups — the Project
  // Manager's read-first counterpart to the Account Manager's Project Review
  // screen, always available regardless of the Weekly/Monthly filtering that
  // only applies to the reporting checklist.
  const dashboardHref = `${base}/dashboard`;
  const dashboardActive = pathname === dashboardHref;

  const completedSections = completion?.filter((c) => c.complete).length ?? 0;

  return (
    <>
      {isMonthly ? (
        <ProgressHeader
          title="Project Performance Progress"
          completed={completedSections}
          total={completion?.length ?? 0}
        />
      ) : null}
      <nav className={cn("flex flex-col gap-2", isMonthly ? "mt-4" : "mt-8")}>
        {visibleGroups.map((group) => (
          <div key={group.heading}>
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-bold text-slate-800">
              <group.icon className="size-5 shrink-0 text-[#1a6fc4]" />
              {group.heading}
            </div>
            <div className="mt-1 mb-1 ml-5 flex flex-col gap-0.5 border-l border-slate-200 pl-3">
              {group.items.map((item) => {
                // Monthly: the RAIDO entry expands into its five logs, each
                // linking to its tab (?tab=) and ticking off on its own.
                if (isMonthly && item.label === "Project RAIDO Register") {
                  const activeTab = searchParams.get("tab") ?? "risk";
                  return (
                    <div key={item.label} className="flex flex-col gap-0.5">
                      <span className="px-3 pt-2 pb-1 text-sm font-semibold text-slate-700">
                        RAIDO Register
                      </span>
                      <div className="ml-4 flex flex-col gap-0.5 border-l border-slate-200 pl-2">
                        {RAIDO_LOGS.map((log) => {
                          const logActive =
                            pathname === item.href && activeTab === log.key;
                          return (
                            <Link
                              key={log.key}
                              href={`${item.href}?tab=${log.key}${period ? `&period=${period}` : ""}`}
                              aria-current={logActive ? "page" : undefined}
                              className={cn(
                                childClass,
                                logActive ? activeClass : idleClass,
                              )}
                            >
                              {log.label}
                              <StatusIcon
                                done={
                                  !!completion?.find(
                                    (c) => c.page_type === log.section,
                                  )?.complete
                                }
                              />
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={`${item.href}${suffix}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(childClass, active ? activeClass : idleClass)}
                  >
                    {item.label}
                    <StatusIcon done={isDone(item)} />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <Link
        href={`${dashboardHref}${suffix}`}
        aria-current={dashboardActive ? "page" : undefined}
        className={cn(
          buttonVariants({ size: "lg" }),
          "mt-4 w-full justify-between bg-[#1a4a7a] font-semibold text-white hover:bg-[#15406b]",
          dashboardActive && "ring-2 ring-[#1a4a7a]/40",
        )}
      >
        Preview Report and Submit
        <Send className="size-4 shrink-0" />
      </Link>
    </>
  );
}

// Project Status always uses the Report Progress rail. The dashboard route is
// shared by Weekly (Submit Report) and Monthly (Project Performance) — only the
// weekly one gets the rail; monthly keeps the regular checklist nav.
function WeeklyReportRail({
  pathname,
  submitPath,
  groups,
  base,
}: {
  pathname: string;
  submitPath: string;
  groups: NavGroup[];
  base: string;
}) {
  const period = useSearchParams().get("period");
  const { data: periods = [] } = useReportingPeriods();
  const isMonthlyDashboard =
    pathname === submitPath &&
    periods.find((p) => p.id === period)?.period_type === "Monthly";

  if (isMonthlyDashboard) {
    return (
      <aside className="w-72 shrink-0 border-l border-[#94A3B3] bg-white shadow-[-4px_0_14px_rgba(15,23,42,0.16)] px-4 pt-0 pb-8">
        <NavLinks groups={groups} pathname={pathname} base={base} />
      </aside>
    );
  }
  return (
    <ProjectReportRail mode={pathname === submitPath ? "submit" : "status"} />
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
  const isHub =
    pathname === base ||
    pathname === `${base}/delivery` ||
    pathname === `${base}/delivery-calendar` ||
    pathname === `${base}/performance`;
  if (isHub) return null;

  // The weekly Delivery Status Report (Project Status + RAG Status) and its
  // Submit Report screen share one Report Progress rail, so the right-hand
  // side doesn't change when moving between them.
  const statusPath = `${base}/project-status`;
  const submitPath = `${base}/dashboard`;
  if (pathname === statusPath || pathname === submitPath) {
    return (
      <Suspense
        fallback={
          <aside className="w-72 shrink-0 border-l border-slate-200 bg-white" />
        }
      >
        <WeeklyReportRail
          pathname={pathname}
          submitPath={submitPath}
          groups={groups}
          base={base}
        />
      </Suspense>
    );
  }

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white px-4 pt-0 pb-8">
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
