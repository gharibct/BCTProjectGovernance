"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Building2,
  ChartColumn,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Eye,
  FileBarChart2,
  FilePlus2,
  FileSearch,
  ClipboardList,
  FolderOpen,
  Globe,
  HeartPulse,
  LayoutGrid,
  ListChecks,
  Coins,
  Map as MapIcon,
  Plug,
  Plus,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { NEW_PROJECT_SEGMENT } from "@/stores/new-project-ui";
import type { Project } from "@/lib/api/projects";
import type { Account, Geo } from "@/lib/api/reference-data";
import { MENU_LABEL_OVERRIDES, ROLE_MENU_SECTIONS, type MenuEntryId } from "@/lib/menu-config";
import { useSession } from "@/stores/session";
import { usePatchScope } from "@/hooks/use-patch-scope";

// --- Sidebar color system ---------------------------------------------------
// Centralized here (this file already owns the sidebar's styling — no
// separate design-token module exists for it) rather than hardcoded per call
// site, so the palette stays a single source of truth.
//
// Font size is NOT in here — it varies by menu level (see the `bold` prop on
// SimpleLink/CollapsibleGroup and CollapsibleSection's own hardcoded size).
const itemClass =
  "flex w-full items-center justify-start gap-3.5 rounded-lg px-4 py-2.5 text-left text-white transition-colors";

// "Project Health Dashboard" — the primary destination. Always shown in this
// strong accent regardless of active/idle (it's meant to look like the one
// place you're always one click from, not something that only lights up
// when you happen to be on it).
const dashboardClass = "bg-[#8B5CF6] hover:bg-[#7C3AED]";

// Group header ("My Work" / "My Reports") base tones — per
// design-reference/menu-style.png ("Option 5: Blue + Green" — teal for
// work/transactions, blue for reports/oversight; a deliberate, explicit
// exception to the sidebar's otherwise blue-only palette). Both use the same
// generic brightness-based hover since their base colors differ.
const SECTION_HEADER_COLORS: Record<string, string> = {
  "My Work": "bg-[#14B8A6]",
  "Team Worklist": "bg-[#14B8A6]",
  "My Reports": "bg-[#3B8DE3]",
};
const sectionHeaderHoverClass = "hover:brightness-110";

// Legacy solid highlight — still used by the handful of bare, out-of-scope
// role menus (Admin / PMO / Team Member) this styling pass doesn't touch.
const activeClass = "bg-[#3f8ce0]";
const idleClass = "hover:bg-white/10";

// Selected / hover treatment for CHILD items — a left accent bar plus a
// subtle tinted background, kept visually distinct from both the group
// header's own tone and a plain hover. `childBaseClass`'s border is always
// present (transparent when idle) so toggling active state never shifts
// layout. Square corners (no rounding) — a child item is a plain list row,
// not a button, unlike Dashboard/the group headers.
const childBaseClass = "border-l-[4px] rounded-none";
const childActiveClass = "border-[#3B8DE3] bg-[#3278B8]/40";
const childIdleClass = "border-transparent hover:bg-[#3278B8]/20";

// Hierarchy divider line (a group's children, and a nested project/entity
// list) — deliberately subdued so it doesn't compete with icons/text.
const hierarchyLineClass = "border-[#4D789C]/25";

// Shared open/close state for the two collapsible wrappers below. `persistKey`
// (only passed by CollapsibleSection, the "My Work"/"My Reports"
// headings) remembers the choice in localStorage across reloads; the
// per-item CollapsibleGroup below never passes one, so its behavior is
// unchanged (ephemeral, resets to defaultOpen on remount). `openByDefault`
// only matters the first time (no persisted choice yet, and not currently on
// an active route inside it) — CollapsibleSection passes true so a fresh
// visit shows the group open rather than closed; CollapsibleGroup leaves it
// at the default false (a project list shouldn't be open by default).
function useCollapsibleState(defaultOpen: boolean, persistKey?: string, openByDefault = false) {
  const [open, setOpen] = React.useState(() => {
    if (defaultOpen) return true;
    if (persistKey) {
      try {
        const raw = localStorage.getItem(persistKey);
        if (raw !== null) return raw === "1";
      } catch {
        // localStorage unavailable (private browsing, etc.) — non-critical.
      }
    }
    return openByDefault;
  });

  const toggle = React.useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (persistKey) {
        try {
          localStorage.setItem(persistKey, next ? "1" : "0");
        } catch {
          // ignore
        }
      }
      return next;
    });
  }, [persistKey]);

  return [open, toggle] as const;
}

function CollapsibleGroup({
  icon: Icon,
  label,
  active,
  children,
  defaultOpen,
  persistKey,
  bold = true,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  children: React.ReactNode;
  defaultOpen: boolean;
  persistKey?: string;
  bold?: boolean;
}) {
  const [open, toggle] = useCollapsibleState(defaultOpen, persistKey);
  // Selected state is slightly bolder than a plain child item's normal
  // weight, but never competes with a group header's own semibold.
  const weightClass = bold || active ? "font-semibold" : "font-normal";
  const stateClass = bold
    ? active
      ? activeClass
      : idleClass
    : cn(childBaseClass, active ? childActiveClass : childIdleClass);

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          itemClass,
          "w-full justify-between",
          bold ? "text-[13px]" : "text-[12px]",
          weightClass,
          stateClass
        )}
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
        <div className={cn("mt-1 mb-1 ml-6 flex flex-col gap-0.5 border-l pl-3", hierarchyLineClass)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

// Wraps a labeled group of *different* menu items ("My Work", "Project
// Oversight") — as opposed to CollapsibleGroup, which wraps one item's own
// project/entity list. Renders as a solid, subdued-accent rounded box
// (always on, not just on hover/active like a plain nav row) so it reads as
// its own header control, distinct from both the Dashboard's stronger
// accent and a selected child item's lighter highlight; items below sit
// flush-left with no indent/border, per
// design-reference/left-menu-reference.png.
function CollapsibleSection({
  icon: Icon,
  label,
  persistKey,
  defaultOpen,
  children,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  persistKey: string;
  defaultOpen: boolean;
  children: React.ReactNode;
  colorClass: string;
}) {
  const [open, toggle] = useCollapsibleState(defaultOpen, persistKey, true);

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          itemClass,
          // rounded-md (6px) — slightly less rounded than Dashboard's
          // rounded-lg (8px, from itemClass), so the header reads as a
          // section, not another destination-style control.
          "w-full justify-between rounded-md py-2 text-[13px] font-semibold",
          colorClass,
          sectionHeaderHoverClass
        )}
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
        <div className={cn("mt-1 mb-1 ml-2 flex flex-col gap-1 border-l pl-2", hierarchyLineClass)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function SimpleLink({
  href,
  icon: Icon,
  label,
  active,
  bold = true,
  tone,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  bold?: boolean;
  // "dashboard" — the "Project Health Dashboard" links specifically: always
  // shown in the strong dashboardClass accent, not the plain active/idle
  // toggle every other link uses.
  tone?: "dashboard";
}) {
  const weightClass = bold || active ? "font-semibold" : "font-normal";
  const stateClass =
    tone === "dashboard"
      ? dashboardClass
      : bold
        ? active
          ? activeClass
          : idleClass
        : cn(childBaseClass, active ? childActiveClass : childIdleClass);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(itemClass, bold ? "text-[13px]" : "text-[12px]", weightClass, stateClass)}
    >
      <Icon className="size-5 shrink-0" />
      {label}
    </Link>
  );
}

// A project counts as "Approved" once it's past Pending Approval — Draft and
// Pending Approval are still being set up (Maintain Project); Approved
// onward (Approved/Under Amendment/Ongoing/Hold/Closed/Open Only for Billing)
// is what the DE Project Approval screen produces and is what Amend Project
// operates on.
function isApproved(status: Project["project_status"]): boolean {
  return status !== "Draft" && status !== "Pending Approval";
}

// Report Project Status is narrower than isApproved: a project mid-revision
// (Under Amendment) is back in the charter-editing flow, not a live project
// to report on, so it's excluded here (it still shows under Amend Project).
function canReport(status: Project["project_status"]): boolean {
  return isApproved(status) && status !== "Under Amendment";
}

// Shared renderer for every project list in the sidebar: shows the project
// NAME (single line, ellipsised), sorted by most-recently-modified, capped at
// the 5 newest with a "… more …" toggle for the rest. The currently-open
// project stays visible even when it falls outside the top 5. This sits on top
// of each group's own Draft/Approved filtering.
const RECENT_LIMIT = 5;

function ProjectNavList({
  projects,
  activeId,
  hrefFor,
  emptyLabel,
}: {
  projects: Project[];
  activeId: string | undefined;
  hrefFor: (project: Project) => string;
  emptyLabel: string;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const sorted = React.useMemo(
    () => [...projects].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [projects]
  );

  if (sorted.length === 0) {
    return <p className="px-3 py-2 text-[12px] text-slate-400">{emptyLabel}</p>;
  }

  const head = sorted.slice(0, RECENT_LIMIT);
  const activeProject = activeId ? sorted.find((p) => p.id === activeId) : undefined;
  const visible = showAll
    ? sorted
    : activeProject && !head.includes(activeProject)
      ? [...head, activeProject]
      : head;
  const hiddenCount = sorted.length - visible.length;

  return (
    <>
      {visible.map((project) => {
        const active = project.id === activeId;
        return (
          <Link
            key={project.id}
            href={hrefFor(project)}
            title={project.project_name}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block w-full truncate rounded-md px-3 py-2 text-left text-[12px] transition-colors",
              active
                ? "bg-white/15 font-semibold text-white"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            )}
          >
            {project.project_name}
          </Link>
        );
      })}
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="px-3 py-2 text-left text-[12px] font-semibold text-slate-400 transition-colors hover:text-white"
        >
          … {hiddenCount} more …
        </button>
      ) : null}
      {showAll && sorted.length > RECENT_LIMIT ? (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="px-3 py-2 text-left text-[12px] font-semibold text-slate-400 transition-colors hover:text-white"
        >
          Show less
        </button>
      ) : null}
    </>
  );
}

function EntityNavList<T extends { id: string; name: string }>({
  entities,
  activeId,
  hrefFor,
  emptyLabel,
}: {
  entities: T[];
  activeId: string | undefined;
  hrefFor: (entity: T) => string;
  emptyLabel: string;
}) {
  if (entities.length === 0) {
    return <p className="px-3 py-2 text-[12px] text-slate-400">{emptyLabel}</p>;
  }
  return (
    <>
      {entities.map((entity) => {
        const active = entity.id === activeId;
        return (
          <Link
            key={entity.id}
            href={hrefFor(entity)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block w-full rounded-md px-3 py-2 text-left text-[12px] transition-colors",
              active
                ? "bg-white/15 font-semibold text-white"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            )}
          >
            {entity.name}
          </Link>
        );
      })}
    </>
  );
}

// Everything a MENU_ITEMS render function might need — route-derived
// booleans/ids and patch-scoped lists computed once per render in AppSidebar,
// plus the label-override lookup.
type SidebarCtx = {
  pathname: string;
  labelFor: (id: MenuEntryId, fallback: string) => string;
  routeActive: Partial<Record<MenuEntryId, boolean>>;
  // Group headings ("My Work"/"My Reports", via CollapsibleSection) are
  // always bold; items rendered inside one of those sections are normal
  // weight, per design-reference/left-menu-reference.png. An item outside
  // any heading (e.g. the top "Project Health Dashboard" link, or a flat
  // out-of-scope role's whole menu) stays bold. Computed per-section in
  // AppSidebar's render loop, not per-item.
  bold: boolean;
  isDashboard: boolean;
  isNewProject: boolean;
  isMaintaining: boolean;
  routeProjectId: string | undefined;
  isAmendProject: boolean;
  amendProjectId: string | undefined;
  isProjectReporting: boolean;
  reportingProjectId: string | undefined;
  isDeAssessmentReport: boolean;
  deAssessmentReportProjectId: string | undefined;
  isAccountReporting: boolean;
  reportingAccountId: string | undefined;
  isGeoReporting: boolean;
  reportingGeoId: string | undefined;
  isProjectReview: boolean;
  reviewProjectId: string | undefined;
  isProjectPerformance: boolean;
  performanceProjectId: string | undefined;
  isAccountReview: boolean;
  reviewAccountId: string | undefined;
  isGeoReview: boolean;
  reviewGeoId: string | undefined;
  maintainProjects: Project[];
  reportingProjects: Project[];
  statusReportProjects: Project[];
  reviewProjects: Project[];
  reviewAccounts: Account[];
  reviewGeos: Geo[];
  reportingAccounts: Account[];
  reportingGeos: Geo[];
};

// One render function per MenuEntryId — the single place each item's JSX is
// defined, regardless of how many roles/sections include it. Ordering and
// grouping come entirely from ROLE_MENU_SECTIONS, not from this registry.
const MENU_ITEMS: Record<MenuEntryId, (ctx: SidebarCtx) => React.ReactNode> = {
  dashboard: (ctx) => (
    <SimpleLink href="/dashboard" icon={LayoutGrid} label="My Summary" active={ctx.isDashboard} bold={ctx.bold} />
  ),
  "project-manager-dashboard": (ctx) => (
    <SimpleLink
      href="/project-health"
      icon={LayoutGrid}
      label={ctx.labelFor("project-manager-dashboard", "Project Health Dashboard")}
      active={ctx.pathname.startsWith("/project-health")}
      bold={ctx.bold}
      tone="dashboard"
    />
  ),
  "delivery-excellence-dashboard": (ctx) => (
    <SimpleLink
      href="/project-health"
      icon={LayoutGrid}
      label={ctx.labelFor("delivery-excellence-dashboard", "Project Health Dashboard")}
      active={ctx.pathname.startsWith("/project-health")}
      bold={ctx.bold}
      tone="dashboard"
    />
  ),
  "de-project-requests": (ctx) => (
    <SimpleLink
      href="/de-project-requests"
      icon={FilePlus2}
      label={ctx.labelFor("de-project-requests", "Approve Project Creation")}
      active={ctx.pathname.startsWith("/de-project-requests")}
      bold={ctx.bold}
    />
  ),
  "de-allocation": (ctx) => (
    <SimpleLink
      href="/de-allocation"
      icon={Users}
      label={ctx.labelFor("de-allocation", "Assign DE")}
      active={ctx.pathname.startsWith("/de-allocation")}
      bold={ctx.bold}
    />
  ),
  "de-approval": (ctx) => (
    <SimpleLink
      href="/de-approval"
      icon={ShieldCheck}
      label={ctx.labelFor("de-approval", "Approve Project Setup / Amendment")}
      active={ctx.pathname.startsWith("/de-approval")}
      bold={ctx.bold}
    />
  ),
  "de-assessment": (ctx) => (
    <SimpleLink
      href="/de-assessment"
      icon={ClipboardCheck}
      label={ctx.labelFor("de-assessment", "Create DE Assessment")}
      active={ctx.pathname.startsWith("/de-assessment")}
      bold={ctx.bold}
    />
  ),
  "de-findings": (ctx) => (
    <SimpleLink
      href="/de-findings"
      icon={FileSearch}
      label={ctx.labelFor("de-findings", "DE Findings")}
      active={ctx.pathname.startsWith("/de-findings")}
      bold={ctx.bold}
    />
  ),
  "de-projects": (ctx) => (
    <SimpleLink
      href="/de-projects"
      icon={FolderOpen}
      label={ctx.labelFor("de-projects", "View Projects")}
      active={ctx.pathname.startsWith("/de-projects")}
      bold={ctx.bold}
    />
  ),
  "pmo-dashboard": (ctx) => (
    <SimpleLink
      href="/dashboard/pmo"
      icon={LayoutGrid}
      label="My Summary"
      active={ctx.pathname === "/dashboard/pmo"}
      bold={ctx.bold}
    />
  ),
  "admin-dashboard": (ctx) => (
    <SimpleLink
      href="/dashboard/admin"
      icon={LayoutGrid}
      label="Admin Dashboard"
      active={ctx.pathname === "/dashboard/admin"}
      bold={ctx.bold}
    />
  ),
  "cdo-dashboard": (ctx) => (
    <SimpleLink
      href="/project-health"
      icon={LayoutGrid}
      label={ctx.labelFor("cdo-dashboard", "Project Health Dashboard")}
      active={ctx.pathname.startsWith("/project-health")}
      bold={ctx.bold}
      tone="dashboard"
    />
  ),
  "project-health": (ctx) => (
    <SimpleLink
      href="/project-health"
      icon={HeartPulse}
      label="Project Health"
      active={ctx.pathname.startsWith("/project-health")}
      bold={ctx.bold}
    />
  ),
  "account-manager-dashboard": (ctx) => (
    <SimpleLink
      href="/project-health"
      icon={LayoutGrid}
      label={ctx.labelFor("account-manager-dashboard", "Project Health Dashboard")}
      active={ctx.pathname.startsWith("/project-health")}
      bold={ctx.bold}
      tone="dashboard"
    />
  ),
  "geo-head-dashboard": (ctx) => (
    <SimpleLink
      href="/project-health"
      icon={LayoutGrid}
      label={ctx.labelFor("geo-head-dashboard", "Project Health Dashboard")}
      active={ctx.pathname.startsWith("/project-health")}
      bold={ctx.bold}
      tone="dashboard"
    />
  ),
  "new-project": (ctx) => (
    <SimpleLink
      href="/new-project/new/create"
      icon={Plus}
      label={ctx.labelFor("new-project", "Create Project")}
      active={ctx.isNewProject && !ctx.isMaintaining}
      bold={ctx.bold}
    />
  ),
  "geo-reporting": (ctx) => (
    <CollapsibleGroup
      icon={Globe}
      label={ctx.labelFor("geo-reporting", "Report Geo Status")}
      active={ctx.isGeoReporting}
      defaultOpen={ctx.isGeoReporting}
      bold={ctx.bold}
    >
      <EntityNavList
        entities={ctx.reportingGeos}
        activeId={ctx.reportingGeoId}
        hrefFor={(geo) => `/geo-reporting/${geo.id}`}
        emptyLabel="No geos assigned yet."
      />
    </CollapsibleGroup>
  ),
  "account-reporting": (ctx) => (
    <CollapsibleGroup
      icon={Building2}
      label={ctx.labelFor("account-reporting", "Report Account Status")}
      active={ctx.isAccountReporting}
      defaultOpen={ctx.isAccountReporting}
      bold={ctx.bold}
    >
      <EntityNavList
        entities={ctx.reportingAccounts}
        activeId={ctx.reportingAccountId}
        hrefFor={(account) => `/account-reporting/${account.id}`}
        emptyLabel="No accounts assigned yet."
      />
    </CollapsibleGroup>
  ),
  "maintain-project": (ctx) => (
    <CollapsibleGroup
      icon={Wrench}
      label={ctx.labelFor("maintain-project", "Project Setup")}
      active={ctx.isMaintaining}
      defaultOpen={ctx.isMaintaining}
      bold={ctx.bold}
    >
      <ProjectNavList
        projects={ctx.maintainProjects}
        activeId={ctx.isMaintaining ? ctx.routeProjectId : undefined}
        hrefFor={(project) => `/new-project/${project.id}/project-charter`}
        emptyLabel="No projects yet."
      />
    </CollapsibleGroup>
  ),
  "view-amend-projects": (ctx) => (
    <CollapsibleGroup
      icon={Eye}
      label={ctx.labelFor("view-amend-projects", "Amend Project")}
      active={ctx.isAmendProject}
      defaultOpen={ctx.isAmendProject}
      bold={ctx.bold}
    >
      <ProjectNavList
        projects={ctx.reportingProjects}
        activeId={ctx.amendProjectId}
        hrefFor={(project) => `/amend-project/${project.id}/project-charter`}
        emptyLabel="No approved projects yet."
      />
    </CollapsibleGroup>
  ),
  "project-reporting": (ctx) => (
    <CollapsibleGroup
      icon={FolderOpen}
      label={ctx.labelFor("project-reporting", "Report Project Status")}
      active={ctx.isProjectReporting}
      defaultOpen={ctx.isProjectReporting}
      bold={ctx.bold}
    >
      <ProjectNavList
        projects={ctx.statusReportProjects}
        activeId={ctx.reportingProjectId}
        hrefFor={(project) => `/project-reporting/${project.id}`}
        emptyLabel="No approved projects yet."
      />
    </CollapsibleGroup>
  ),
  "geo-review": (ctx) => (
    <CollapsibleGroup
      icon={CheckCircle2}
      label={ctx.labelFor("geo-review", "Geo Delivery Status")}
      active={ctx.isGeoReview}
      defaultOpen={ctx.isGeoReview}
      bold={ctx.bold}
    >
      <EntityNavList
        entities={ctx.reviewGeos}
        activeId={ctx.reviewGeoId}
        hrefFor={(geo) => `/geo-review/${geo.id}`}
        emptyLabel="No geos to review yet."
      />
    </CollapsibleGroup>
  ),
  "account-review": (ctx) => (
    <CollapsibleGroup
      icon={ShieldCheck}
      label={ctx.labelFor("account-review", "Account Delivery Status")}
      active={ctx.isAccountReview}
      defaultOpen={ctx.isAccountReview}
      bold={ctx.bold}
    >
      <EntityNavList
        entities={ctx.reviewAccounts}
        activeId={ctx.reviewAccountId}
        hrefFor={(account) => `/account-review/${account.id}`}
        emptyLabel="No accounts to review yet."
      />
    </CollapsibleGroup>
  ),
  "admin-users-roles": (ctx) => (
    <SimpleLink
      href="/admin/users"
      icon={Users}
      label="Users & Roles"
      active={ctx.pathname.startsWith("/admin/users")}
      bold={ctx.bold}
    />
  ),
  "admin-integrations": (ctx) => (
    <>
      <SimpleLink
        href="/admin/accounts"
        icon={Plug}
        label="Accounts"
        active={ctx.pathname.startsWith("/admin/accounts")}
        bold={ctx.bold}
      />
      <SimpleLink
        href="/admin/geos"
        icon={Globe}
        label="Geos"
        active={ctx.pathname.startsWith("/admin/geos")}
        bold={ctx.bold}
      />
    </>
  ),
  "admin-regions": (ctx) => (
    <SimpleLink
      href="/admin/regions"
      icon={MapIcon}
      label="Regions"
      active={ctx.pathname.startsWith("/admin/regions")}
      bold={ctx.bold}
    />
  ),
  "admin-exchange-rates": (ctx) => (
    <SimpleLink
      href="/admin/exchange-rates"
      icon={Coins}
      label="Exchange Rates"
      active={ctx.pathname.startsWith("/admin/exchange-rates")}
      bold={ctx.bold}
    />
  ),
  "admin-bulk-projects": (ctx) => (
    <SimpleLink
      href="/admin/projects/bulk"
      icon={FolderOpen}
      label="Bulk Projects"
      active={ctx.pathname.startsWith("/admin/projects/bulk")}
      bold={ctx.bold}
    />
  ),
  "admin-bulk-status-projects": (ctx) => (
    <SimpleLink
      href="/admin/delivery-status/projects"
      icon={ClipboardList}
      label="Bulk DSR - Projects"
      active={ctx.pathname.startsWith("/admin/delivery-status/projects")}
      bold={ctx.bold}
    />
  ),
  "admin-bulk-status-accounts": (ctx) => (
    <SimpleLink
      href="/admin/delivery-status/accounts"
      icon={ClipboardList}
      label="Bulk DSR - Accounts"
      active={ctx.pathname.startsWith("/admin/delivery-status/accounts")}
      bold={ctx.bold}
    />
  ),
  "project-review": (ctx) => (
    <CollapsibleGroup
      icon={ClipboardCheck}
      label={ctx.labelFor("project-review", "Project Delivery Status")}
      active={ctx.isProjectReview}
      defaultOpen={ctx.isProjectReview}
      bold={ctx.bold}
    >
      <ProjectNavList
        projects={ctx.reviewProjects}
        activeId={ctx.reviewProjectId}
        hrefFor={(project) => `/project-review/${project.id}`}
        emptyLabel="No projects to review yet."
      />
    </CollapsibleGroup>
  ),
  "project-performance": (ctx) => (
    <CollapsibleGroup
      icon={ChartColumn}
      label={ctx.labelFor("project-performance", "Project Performance")}
      active={ctx.isProjectPerformance}
      defaultOpen={ctx.isProjectPerformance}
      bold={ctx.bold}
    >
      <ProjectNavList
        projects={ctx.reviewProjects}
        activeId={ctx.performanceProjectId}
        hrefFor={(project) => `/project-performance/${project.id}`}
        emptyLabel="No projects yet."
      />
    </CollapsibleGroup>
  ),
  actions: (ctx) => (
    <SimpleLink
      href="/actions"
      icon={ListChecks}
      label={ctx.labelFor("actions", "Actions")}
      active={ctx.pathname.startsWith("/actions")}
      bold={ctx.bold}
    />
  ),
  "de-assessment-report": (ctx) => (
    <CollapsibleGroup
      icon={ShieldCheck}
      label={ctx.labelFor("de-assessment-report", "DE Assessment")}
      active={ctx.isDeAssessmentReport}
      defaultOpen={ctx.isDeAssessmentReport}
      bold={ctx.bold}
    >
      <ProjectNavList
        projects={ctx.statusReportProjects}
        activeId={ctx.deAssessmentReportProjectId}
        hrefFor={(project) => `/de-assessment/${project.id}`}
        emptyLabel="No approved projects yet."
      />
    </CollapsibleGroup>
  ),
  "pm-findings": (ctx) => (
    <SimpleLink
      href="/pm-findings"
      icon={FileSearch}
      label={ctx.labelFor("pm-findings", "DE Findings")}
      active={ctx.pathname.startsWith("/pm-findings")}
      bold={ctx.bold}
    />
  ),
  reassignment: (ctx) => (
    <SimpleLink
      href="/reassignment"
      icon={UserCog}
      label={ctx.labelFor("reassignment", "Reassign Owners")}
      active={ctx.pathname.startsWith("/reassignment")}
      bold={ctx.bold}
    />
  ),
};

const SECTION_ICONS: Record<string, React.ElementType> = {
  "My Work": Briefcase,
  "My Reports": FileBarChart2,
  "Team Worklist": Users,
};

export function AppSidebar() {
  const pathname = usePathname();
  const user = useSession((s) => s.user);
  const workContext = useSession((s) => s.workContext);

  // The role whose menu applies right now: the chosen Work Context, else the
  // real role. `realRole` still governs which accounts/projects the user may
  // touch — a Geo Head "acting as PM" is still bounded by their own geo(s).
  const realRole = user?.role.code;
  const effectiveRole = workContext ?? realRole;

  // The user's real patch — the accounts / geo(s) / projects they own,
  // independent of the chosen context (Geo Head: everything in their geo;
  // Account Head: their accounts; PM/Admin/CDO: everything). Shared with the
  // standalone Actions page — see use-patch-scope.ts.
  const { patchProjects, reportingAccounts, reportingGeos } = usePatchScope();

  const maintainProjects = patchProjects.filter((p) => !isApproved(p.project_status));
  const reportingProjects = patchProjects.filter((p) => isApproved(p.project_status));
  const statusReportProjects = patchProjects.filter((p) => canReport(p.project_status));

  // The "review" (one level up) lists — now that every list is already
  // patch-scoped, review and reporting scopes coincide.
  const reviewProjects = reportingProjects;
  const reviewAccounts = reportingAccounts;
  const reviewGeos = reportingGeos;

  const isDashboard = pathname === "/dashboard";
  const isNewProject = pathname.startsWith("/new-project");
  const isProjectReporting = pathname.startsWith("/project-reporting");
  const isAccountReporting = pathname.startsWith("/account-reporting");
  const isGeoReporting = pathname.startsWith("/geo-reporting");
  const isProjectReview = pathname.startsWith("/project-review");
  const isProjectPerformance = pathname.startsWith("/project-performance");
  const isAccountReview = pathname.startsWith("/account-review");
  const isGeoReview = pathname.startsWith("/geo-review");
  // The :projectId route segment is the single source of truth for which of
  // "New Project" (segment === "new") vs "Maintain Project" (a real id) is
  // active — no separate client-side intent flag to keep in sync.
  const routeProjectId = isNewProject ? pathname.split("/")[2] : undefined;
  const isMaintaining = isNewProject && routeProjectId !== NEW_PROJECT_SEGMENT;
  // Amend Project is its own route tree (mirrors /project-reporting), so
  // "Maintain" vs "Amend" is now a plain path-prefix check — no status
  // disambiguation needed.
  const isAmendProject = pathname.startsWith("/amend-project");
  const amendProjectId = isAmendProject ? pathname.split("/")[2] : undefined;
  // /project-reporting/{projectId}(/...) — every project-reporting route is
  // nested under a :projectId segment, including the hub page itself.
  const reportingProjectId = isProjectReporting ? pathname.split("/")[2] : undefined;
  const isDeAssessmentReport = pathname.startsWith("/de-assessment");
  const deAssessmentReportProjectId = isDeAssessmentReport ? pathname.split("/")[2] : undefined;
  const reportingAccountId = isAccountReporting ? pathname.split("/")[2] : undefined;
  const reportingGeoId = isGeoReporting ? pathname.split("/")[2] : undefined;
  const reviewProjectId = isProjectReview ? pathname.split("/")[2] : undefined;
  const performanceProjectId = isProjectPerformance ? pathname.split("/")[2] : undefined;
  const reviewAccountId = isAccountReview ? pathname.split("/")[2] : undefined;
  const reviewGeoId = isGeoReview ? pathname.split("/")[2] : undefined;

  const labelFor = React.useCallback(
    (id: MenuEntryId, fallback: string) =>
      (effectiveRole && MENU_LABEL_OVERRIDES[effectiveRole]?.[id]) ?? fallback,
    [effectiveRole]
  );

  const routeActive: Partial<Record<MenuEntryId, boolean>> = {
    "maintain-project": isMaintaining,
    "view-amend-projects": isAmendProject,
    "project-reporting": isProjectReporting,
    "de-assessment-report": isDeAssessmentReport,
    "project-review": isProjectReview,
    "project-performance": isProjectPerformance,
    "account-review": isAccountReview,
    "geo-review": isGeoReview,
    "account-reporting": isAccountReporting,
    "geo-reporting": isGeoReporting,
    "new-project": isNewProject && !isMaintaining,
    reassignment: pathname.startsWith("/reassignment"),
    actions: pathname.startsWith("/actions"),
    "de-findings": pathname.startsWith("/de-findings"),
    "pm-findings": pathname.startsWith("/pm-findings"),
  };

  const ctx: SidebarCtx = {
    pathname,
    labelFor,
    routeActive,
    // Overridden per-section in the render loop below (bare vs. headed).
    bold: true,
    isDashboard,
    isNewProject,
    isMaintaining,
    routeProjectId,
    isAmendProject,
    amendProjectId,
    isProjectReporting,
    reportingProjectId,
    isDeAssessmentReport,
    deAssessmentReportProjectId,
    isAccountReporting,
    reportingAccountId,
    isGeoReporting,
    reportingGeoId,
    isProjectReview,
    reviewProjectId,
    isProjectPerformance,
    performanceProjectId,
    isAccountReview,
    reviewAccountId,
    isGeoReview,
    reviewGeoId,
    maintainProjects,
    reportingProjects,
    statusReportProjects,
    reviewProjects,
    reviewAccounts,
    reviewGeos,
    reportingAccounts,
    reportingGeos,
  };

  const sections = effectiveRole ? (ROLE_MENU_SECTIONS[effectiveRole] ?? []) : [];

  return (
    <aside className="w-64 shrink-0 bg-[#174F7E] py-6">
      <nav className="flex flex-col gap-2 px-3">
        {sections.map((section, index) => {
          // Items directly under a heading ("My Work"/"My Reports")
          // are normal weight; a bare (heading-less) section's items stay
          // bold — see design-reference/left-menu-reference.png.
          const sectionCtx: SidebarCtx = { ...ctx, bold: !section.heading };
          const rendered = section.items.map((id) => (
            <React.Fragment key={id}>{MENU_ITEMS[id](sectionCtx)}</React.Fragment>
          ));
          if (!section.heading) {
            return <React.Fragment key={index}>{rendered}</React.Fragment>;
          }
          const defaultOpen = section.items.some((id) => routeActive[id]);
          return (
            <CollapsibleSection
              key={section.heading}
              icon={SECTION_ICONS[section.heading] ?? FolderOpen}
              label={section.heading}
              persistKey={`sidebar:section:${effectiveRole}:${section.heading}`}
              defaultOpen={defaultOpen}
              colorClass={SECTION_HEADER_COLORS[section.heading] ?? "bg-[#28679F]"}
            >
              {rendered}
            </CollapsibleSection>
          );
        })}
      </nav>
    </aside>
  );
}
