"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  Circle,
  CircleCheck,
  ClipboardList,
  FileText,
  NotebookText,
  SendHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { CURRENT_PERIOD } from "@/components/shell/reporting-period-badge";
import { useNewProjectId } from "@/stores/new-project-ui";
import { useProject, useProjectOracleIds } from "@/lib/api/projects";
import { useCommitments, useMilestonePayments } from "@/lib/api/contractual";
import {
  useAssumptions,
  useDependencies,
  useIssues,
  useOpportunities,
  useRisks,
} from "@/lib/api/raid";

// The project navigation rail for the project-setup screens. Backs both
// /new-project/[projectId]/* (New Project + Maintain Project) and
// /amend-project/[projectId]/* (Amend Project) — the route prefix is derived
// from the current path, and the "Approval" group (Send To Approval) is
// dropped in the amend tree since it only applies to Draft projects.
// Every item is its own route so the browser URL, back button, and this
// nav's active state all agree — no in-page tab switching. `done` marks
// whether the task is completed for the current reporting period. Project
// Profile and Scope & Schedule are backed by the project's derived
// profile_completion_flag/schedule_completion_flag; Map Oracle Projects,
// Contractual Compliance, and RAIDO are done once their registers have at
// least one row each. Measurement is the only one still a sample value,
// pending its own backend wiring. Self Assessment ("RAG Status") and DE
// Assessment live only in the Project Reporting nav (project-nav.tsx), not
// here — they're period-driven reporting tasks, not creation-time setup.
type NavItem = {
  label: string;
  href: string;
  done: boolean;
};

// Every href is relative to the current :projectId route segment (see
// buildGroups) so navigating between tabs stays on the same project/draft.
function buildGroups(
  base: string,
  hasProject: boolean,
  profileComplete: boolean,
  scheduleComplete: boolean,
  oracleMapped: boolean,
  contractualComplianceComplete: boolean,
  raidoComplete: boolean,
  sentForApproval: boolean,
  isAmend: boolean,
  amendmentActive: boolean,
): { heading: string; icon: LucideIcon; items: NavItem[] }[] {
  return [
    {
      heading: "AI Hub",
      icon: Sparkles,
      // Not a period-completion task like the groups below, so there's no
      // pending/done signal to derive — always shown as done so it never
      // reads as an outstanding checklist item.
      items: [
        { label: "AI Document Processing", href: `${base}/ai-hub/document-processing`, done: true },
      ],
    },
    {
      heading: "Project Charter",
      icon: FileText,
      items: [
        {
          label: "Map Oracle Projects",
          href: `${base}/map-oracle-projects`,
          done: oracleMapped,
        },
        {
          label: "Project Profile",
          // Before creation, Project Profile IS the mandatory Create Project
          // screen (Project Name + at least one Oracle mapping) — route
          // there instead of straight to the untouched post-creation form,
          // so the nav rail can't be used to bypass that requirement.
          href: hasProject ? `${base}/project-charter` : `${base}/create`,
          done: profileComplete,
        },
        {
          label: "Scope & Schedule",
          href: `${base}/project-charter/schedule`,
          done: scheduleComplete,
        },
      ],
    },
    {
      heading: "Project Baseline",
      icon: ClipboardList,
      items: [
        { label: "Measurement", href: `${base}/measurement`, done: false },
        // Contractual Compliance stays on the Amend rail (full add/edit/delete
        // of commitments & milestones); Project Reporting only records actuals.
        // RAIDO is still Amend-excluded — it's maintained from Reporting.
        {
          label: "Contractual Compliance",
          href: `${base}/contractual-compliance`,
          done: contractualComplianceComplete,
        },
      ],
    },
    ...(isAmend
      ? []
      : [
          {
            // RAIDO is not part of the mandatory approval baseline, so it lives
            // in its own register group rather than under Project Baseline.
            heading: "Project Register",
            icon: NotebookText,
            items: [
              { label: "RAIDO Register", href: `${base}/raido`, done: raidoComplete },
            ],
          },
        ]),
    // PM governance-completeness + submission. In the Maintain tree this is the
    // one-shot "Send To Approval"; in the Amend tree it's the two-step "Amend &
    // Approve" group (Initiate Amend, then Send To Approve).
    ...(isAmend
      ? [
          {
            heading: "Amend & Approve",
            icon: SendHorizontal,
            items: [
              { label: "Initiate Amend", href: `${base}/initiate-amend`, done: amendmentActive },
              { label: "Send To Approve", href: `${base}/send-to-approval`, done: sentForApproval },
            ],
          },
        ]
      : [
          {
            heading: "Approval",
            icon: SendHorizontal,
            items: [
              { label: "Send To Approval", href: `${base}/send-to-approval`, done: sentForApproval },
            ],
          },
        ]),
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

export function NewProjectNav() {
  const pathname = usePathname();
  const { projectId } = useParams<{ projectId: string }>();
  // "new-project" | "amend-project" — the same rail serves both trees.
  const routePrefix = pathname.split("/")[1] || "new-project";
  const isAmend = routePrefix === "amend-project";
  // The mandatory Create Project step (no project exists yet) has nothing
  // else to navigate to, so the rail is dropped entirely on that screen.
  const isCreateStep = pathname.endsWith("/create");
  const newProjectId = useNewProjectId();
  const { data: project } = useProject(newProjectId);
  const { data: oracleIds } = useProjectOracleIds(newProjectId);
  const { data: commitments } = useCommitments(newProjectId);
  const { data: milestones } = useMilestonePayments(newProjectId);
  const { data: risks } = useRisks(newProjectId);
  const { data: issues } = useIssues(newProjectId);
  const { data: dependencies } = useDependencies(newProjectId);
  const { data: assumptions } = useAssumptions(newProjectId);
  const { data: opportunities } = useOpportunities(newProjectId);

  if (isCreateStep) return null;

  const groups = buildGroups(
    `/${routePrefix}/${projectId}`,
    !!newProjectId,
    project?.profile_completion_flag ?? false,
    project?.schedule_completion_flag ?? false,
    (oracleIds?.length ?? 0) > 0,
    (commitments?.length ?? 0) > 0 && (milestones?.length ?? 0) > 0,
    (risks?.length ?? 0) > 0 &&
      (issues?.length ?? 0) > 0 &&
      (dependencies?.length ?? 0) > 0 &&
      (assumptions?.length ?? 0) > 0 &&
      (opportunities?.length ?? 0) > 0,
    isAmend
      ? project?.project_status === "Pending Approval"
      : !!project && project.project_status !== "Draft",
    isAmend,
    project?.project_status === "Under Amendment" || project?.project_status === "Pending Approval",
  );

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white px-4 py-8">
      <nav className="flex flex-col gap-2">
        {groups.map((group) => (
          <div key={group.heading}>
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-bold text-slate-800">
              <group.icon className="size-5 shrink-0 text-[#1a6fc4]" />
              {group.heading}
            </div>
            <div className="mt-1 mb-1 ml-5 flex flex-col gap-0.5 border-l border-slate-200 pl-3">
              {group.items.map((item) => {
                const active = pathname === item.href;
                // Every tab but the one you're on is locked until the
                // project exists — there's nothing to show them yet.
                const locked = !newProjectId && item.label !== "Project Profile";
                if (locked) {
                  return (
                    <span
                      key={item.label}
                      aria-disabled="true"
                      className={cn(childClass, "cursor-not-allowed text-slate-300")}
                    >
                      {item.label}
                      <StatusIcon done={item.done} />
                    </span>
                  );
                }
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
