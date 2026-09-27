"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardCheck,
  FolderOpen,
  Handshake,
  HeartPulse,
  ShieldAlert,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useEffectiveRole } from "@/stores/session";
import { childClass, activeClass, idleClass } from "./nav-primitives";

// Project Health's right-side "REPORTS" nav (design-reference/Project-Health.html,
// design-reference/project-health-screens.md) — same shell as ProjectNav/
// AccountNav (childClass/activeClass/idleClass from nav-primitives.tsx), but
// flat links with no per-period "done" tracking, since these are portfolio-
// wide report screens rather than a reporting-period completion checklist.

type NavItem = { label: string; href: string };
type NavSection = { heading: string; icon: LucideIcon; items: NavItem[] };

const SECTIONS: NavSection[] = [
  { heading: "Overview", icon: HeartPulse, items: [{ label: "Project Health", href: "/project-health" }] },
  {
    heading: "Project & Account",
    icon: FolderOpen,
    items: [
      { label: "Project List", href: "/project-health/project-list" },
      { label: "RAG", href: "/project-health/rag" },
      { label: "Account RAG", href: "/project-health/account-rag" },
      { label: "Oracle Projects", href: "/project-health/oracle-projects" },
    ],
  },
  {
    heading: "RAIDO",
    icon: ShieldAlert,
    items: [
      { label: "Risks", href: "/project-health/risks" },
      { label: "Issues", href: "/project-health/issues" },
      { label: "Dependencies", href: "/project-health/dependencies" },
      { label: "Assumptions", href: "/project-health/assumptions" },
      { label: "Opportunities", href: "/project-health/opportunities" },
    ],
  },
  { heading: "Performance", icon: BarChart3, items: [{ label: "Metrics", href: "/project-health/metrics" }] },
  {
    heading: "Commercial",
    icon: Handshake,
    items: [
      { label: "Commitments", href: "/project-health/commitments" },
      { label: "Payment Milestones", href: "/project-health/payment-milestones" },
    ],
  },
  {
    heading: "Delivery Excellence",
    icon: ShieldCheck,
    items: [
      { label: "Assessments", href: "/project-health/assessments" },
      { label: "Findings", href: "/project-health/findings" },
    ],
  },
  {
    heading: "Governance",
    icon: ClipboardCheck,
    items: [
      { label: "Actions", href: "/project-health/actions" },
      { label: "Data Integrity", href: "/project-health/data-integrity" },
      { label: "Report Submissions", href: "/project-health/report-submissions" },
    ],
  },
  {
    heading: "Customer Reporting",
    icon: Users,
    items: [
      { label: "Project Status Reporting", href: "/project-health/customer-project-reports" },
      { label: "Account Reporting", href: "/project-health/customer-account-reports" },
    ],
  },
];

export function ProjectHealthNav() {
  const pathname = usePathname();
  // Oracle Projects is withheld from Project Managers / Team Members (the API 403s for them).
  const role = useEffectiveRole();
  const hideOracleProjects = role === "PROJECT_MANAGER" || role === "TEAM_MEMBER";

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white px-4 py-8">
      <p className="px-3 text-xs font-bold tracking-wide text-slate-500 uppercase">Reports</p>

      <nav className="mt-4 flex flex-col gap-2">
        {SECTIONS.map((section) => (
          <div key={section.heading}>
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-bold text-slate-800">
              <section.icon className="size-5 shrink-0 text-[#1a6fc4]" />
              {section.heading}
            </div>
            <div className="mt-1 mb-1 ml-5 flex flex-col gap-0.5 border-l border-slate-200 pl-3">
              {section.items
                .filter((item) => !(hideOracleProjects && item.href === "/project-health/oracle-projects"))
                .map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(childClass, active ? activeClass : idleClass)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
