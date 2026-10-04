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
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ProgressHeader } from "@/components/shell/progress-header";
import { CURRENT_PERIOD } from "@/components/shell/reporting-period-badge";
import { useNewProjectId } from "@/stores/new-project-ui";
import { useProject, useProjectOracleIds } from "@/lib/api/projects";
import { useCommitments, useMilestonePayments } from "@/lib/api/contractual";
import { useProjectTypes } from "@/lib/api/reference-data";
import {
  useCloudMaintenanceTarget,
  useCloudMigrationTarget,
  useConsultingTarget,
  useDevelopmentTarget,
  useStaffingTarget,
  useSupportTarget,
  useTestingTarget,
} from "@/lib/api/metric-targets";
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
// Contractual Commitments, Milestones, and RAIDO are done once their registers have at
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
  commitmentsComplete: boolean,
  milestonesComplete: boolean,
  raidoComplete: boolean,
  measurementReviewed: boolean,
  sentForApproval: boolean,
  isAmend: boolean,
  amendmentActive: boolean,
): { heading: string; icon: LucideIcon; items: NavItem[] }[] {
  return [
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
        // Read-only view of the Oracle allocations, not a completion task —
        // always shown as done, like AI Document Processing above.
        {
          label: "Resource Allocation",
          href: `${base}/resource-allocation`,
          done: true,
        },
      ],
    },
    {
      heading: "Project Baseline",
      icon: ClipboardList,
      items: [
        {
          label: "Measurement",
          href: `${base}/measurement`,
          done: measurementReviewed,
        },
        // Contractual Compliance stays on the Amend rail (full add/edit/delete
        // of commitments & milestones); Project Reporting only records actuals.
        // RAIDO is still Amend-excluded — it's maintained from Reporting.
        {
          label: "Contractual Commitments",
          href: `${base}/contractual-commitments`,
          done: commitmentsComplete,
        },
        {
          label: "Payment Milestones",
          href: `${base}/milestones`,
          done: milestonesComplete,
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
              {
                label: "RAIDO Register",
                href: `${base}/raido`,
                done: raidoComplete,
              },
            ],
          },
        ]),
    // PM governance-completeness + submission. In the Maintain tree this is the
    // one-shot "Send To Approval"; in the Amend tree it's the two-step "Amend &
    // Approve" group (Amendment Request, then Send To Approve).
    ...(isAmend
      ? [
          {
            heading: "Amend & Approve",
            icon: SendHorizontal,
            items: [
              {
                label: "Amendment Request",
                href: `${base}/initiate-amend`,
                done: amendmentActive,
              },
              {
                label: "Send To Approve",
                href: `${base}/send-to-approval`,
                done: sentForApproval,
              },
            ],
          },
        ]
      : [
          {
            heading: "Approval",
            icon: SendHorizontal,
            items: [
              {
                label: "Send To Approval",
                href: `${base}/send-to-approval`,
                done: sentForApproval,
              },
            ],
          },
        ]),
  ];
}

const childClass =
  "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors";
const activeClass = "bg-[#d9eafc] font-bold text-[#15406b]";
const idleClass =
  "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900";

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

// Measurement is done once the project's targets have been reviewed, i.e. the
// target row for its Project Type exists (the "Accept Targets" button saves it).
const DEVELOPMENT_SIZE_EFFORT_KEYS = [
  "target_size_unit",
  "target_overall_planned_size",
  "target_overall_estimated_effort",
];

// Development projects also need Size Unit, Overall Planned Size and Overall
// Estimated Effort for Scope & Schedule to count as done (they have no field on
// the project itself, so schedule_completion_flag can't see them).
function useSizeEffortComplete(projectId: string | null, projectTypeCode: string | undefined) {
  const isDevelopment = projectTypeCode === "DEVELOPMENT";
  const { data } = useDevelopmentTarget(projectId, isDevelopment);
  if (!isDevelopment) return true;
  return (
    !!data &&
    DEVELOPMENT_SIZE_EFFORT_KEYS.every((key) => {
      const value = (data as unknown as Record<string, unknown>)[key];
      return value !== null && value !== undefined && value !== "";
    })
  );
}

function useMeasurementReviewed(
  projectId: string | null,
  projectTypeCode: string | undefined,
) {
  const development = useDevelopmentTarget(
    projectId,
    projectTypeCode === "DEVELOPMENT",
  );
  const support = useSupportTarget(projectId, projectTypeCode === "SUPPORT");
  const staffing = useStaffingTarget(
    projectId,
    projectTypeCode === "PROFESSIONAL_STAFFING",
  );
  const testing = useTestingTarget(projectId, projectTypeCode === "TESTING");
  const cloudMaintenance = useCloudMaintenanceTarget(
    projectId,
    projectTypeCode === "CLOUD_MAINTENANCE",
  );
  const cloudMigration = useCloudMigrationTarget(
    projectId,
    projectTypeCode === "CLOUD_MIGRATION",
  );
  const consulting = useConsultingTarget(
    projectId,
    projectTypeCode === "CONSULTING",
  );
  switch (projectTypeCode) {
    case "DEVELOPMENT":
      // Size Unit / Overall Planned Size / Overall Estimated Effort are saved on
      // this same row from Scope & Schedule, so the row existing isn't enough:
      // Measurement is reviewed once any of its own targets has been saved.
      return (
        !!development.data &&
        Object.entries(development.data).some(
          ([key, value]) =>
            key.startsWith("target_") && !DEVELOPMENT_SIZE_EFFORT_KEYS.includes(key) && value !== null,
        )
      );
    case "SUPPORT":
      return !!support.data;
    case "PROFESSIONAL_STAFFING":
      return !!staffing.data;
    case "TESTING":
      return !!testing.data;
    case "CLOUD_MAINTENANCE":
      return !!cloudMaintenance.data;
    case "CLOUD_MIGRATION":
      return !!cloudMigration.data;
    case "CONSULTING":
      return !!consulting.data;
    default:
      return false;
  }
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
  const { data: projectTypes } = useProjectTypes();
  const projectTypeCode = projectTypes?.find((t) => t.id === project?.project_type_id)?.code;
  const measurementReviewed = useMeasurementReviewed(newProjectId, projectTypeCode);
  const sizeEffortComplete = useSizeEffortComplete(newProjectId, projectTypeCode);
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
    (project?.schedule_completion_flag ?? false) && sizeEffortComplete,
    (oracleIds?.length ?? 0) > 0,
    (commitments?.length ?? 0) > 0,
    (milestones?.length ?? 0) > 0,
    (risks?.length ?? 0) > 0 &&
      (issues?.length ?? 0) > 0 &&
      (dependencies?.length ?? 0) > 0 &&
      (assumptions?.length ?? 0) > 0 &&
      (opportunities?.length ?? 0) > 0,
    measurementReviewed,
    isAmend
      ? project?.project_status === "Pending Approval"
      : !!project && project.project_status !== "Draft",
    isAmend,
    project?.project_status === "Under Amendment" ||
      project?.project_status === "Pending Approval",
  );

  const allItems = groups.flatMap((group) => group.items);
  const completedCount = allItems.filter((item) => item.done).length;

  return (
    <aside className="w-72 shrink-0 border-l border-[#94A3B3] bg-white px-4 pt-0 pb-8 shadow-[-4px_0_14px_rgba(15,23,42,0.16)]">
      <div className="sticky top-0 flex flex-col gap-4">
        <ProgressHeader
          title={isAmend ? "Project Amend Progress" : "Project Setup Progress"}
          completed={completedCount}
          total={allItems.length}
        />
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
                  const locked =
                    !newProjectId && item.label !== "Project Profile";
                  if (locked) {
                    return (
                      <span
                        key={item.label}
                        aria-disabled="true"
                        className={cn(
                          childClass,
                          "cursor-not-allowed text-slate-300",
                        )}
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
                      className={cn(
                        childClass,
                        active ? activeClass : idleClass,
                      )}
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
      </div>
    </aside>
  );
}
