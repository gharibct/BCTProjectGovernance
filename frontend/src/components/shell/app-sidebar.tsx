"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  CalendarDays,
  Coins,
  Map as MapIcon,
  Plug,
  Plus,
  Presentation,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { NEW_PROJECT_SEGMENT } from "@/stores/new-project-ui";
import type { Geo } from "@/lib/api/reference-data";
import { MENU_LABEL_OVERRIDES, ROLE_MENU_SECTIONS, type MenuEntryId } from "@/lib/menu-config";
import { useSession } from "@/stores/session";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { usePatchScope } from "@/hooks/use-patch-scope";
import { selectProjectHref } from "@/lib/project-context-targets";
import { selectAccountHref } from "@/lib/account-context-targets";
import { useAccountContext } from "@/stores/account-context";
import { useProjectContext } from "@/stores/project-context";

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

// Group header ("My Worklist" / "My Reports") base tones — per
// design-reference/menu-style.png ("Option 5: Blue + Green" — teal for
// work/transactions, blue for reports/oversight; a deliberate, explicit
// exception to the sidebar's otherwise blue-only palette). Both use the same
// generic brightness-based hover since their base colors differ.
const SECTION_HEADER_COLORS: Record<string, string> = {
  "My Worklist": "bg-[#14B8A6]",
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
// (only passed by CollapsibleSection, the "My Worklist"/"My Reports"
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

// Wraps a labeled group of *different* menu items ("My Worklist", "Project
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
  // Group headings ("My Worklist"/"My Reports", via CollapsibleSection) are
  // always bold; items rendered inside one of those sections are normal
  // weight, per design-reference/left-menu-reference.png. An item outside
  // any heading (e.g. the top "Project Health Dashboard" link, or a flat
  // out-of-scope role's whole menu) stays bold. Computed per-section in
  // AppSidebar's render loop, not per-item.
  bold: boolean;
  isDashboard: boolean;
  isNewProject: boolean;
  isMaintaining: boolean;
  isAmendProject: boolean;
  isProjectReporting: boolean;
  isDeAssessmentReport: boolean;
  isAccountReporting: boolean;
  isGeoReporting: boolean;
  reportingGeoId: string | undefined;
  isProjectReview: boolean;
  isProjectPerformance: boolean;
  isAccountReview: boolean;
  isGeoReview: boolean;
  reviewGeoId: string | undefined;
  reviewGeos: Geo[];
  reportingGeos: Geo[];
};

// One render function per MenuEntryId — the single place each item's JSX is
// defined, regardless of how many roles/sections include it. Ordering and
// grouping come entirely from ROLE_MENU_SECTIONS, not from this registry.
// Report Delivery Status (Weekly) / Report Project Performance (Monthly). Both
// live under /project-reporting/:projectId; which one is active comes from the
// hub route itself, else from the open period's type (?period=).
function ReportingLink({ kind, ctx }: { kind: "delivery" | "performance"; ctx: SidebarCtx }) {
  const period = useSearchParams().get("period");
  const { data: periods = [] } = useReportingPeriods();
  const type = periods.find((p) => p.id === period)?.period_type;
  const hubKind = ctx.pathname.endsWith("/delivery") || ctx.pathname.endsWith("/delivery-calendar")
    ? "delivery"
    : ctx.pathname.endsWith("/performance")
      ? "performance"
      : null;
  const openKind = hubKind ?? (type === "Weekly" ? "delivery" : type === "Monthly" ? "performance" : null);
  const target = kind === "delivery" ? "delivery-reporting" : "performance-reporting";
  return (
    <SimpleLink
      href={selectProjectHref(target)}
      icon={kind === "delivery" ? FolderOpen : FileBarChart2}
      label={ctx.labelFor(target, kind === "delivery" ? "Report Delivery Status" : "Report Project Performance")}
      active={
        (ctx.isProjectReporting && (openKind === kind || (openKind === null && kind === "delivery"))) ||
        ctx.pathname === selectProjectHref(target)
      }
      bold={ctx.bold}
    />
  );
}

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
    <SimpleLink
      href={selectAccountHref("account-reporting")}
      icon={Building2}
      label={ctx.labelFor("account-reporting", "Report Account Status")}
      active={ctx.isAccountReporting || ctx.pathname === selectAccountHref("account-reporting")}
      bold={ctx.bold}
    />
  ),
  "account-communications": (ctx) => (
    <SimpleLink
      href={selectAccountHref("account-communications")}
      icon={Presentation}
      label={ctx.labelFor("account-communications", "Record Account Presentation")}
      active={!!ctx.routeActive["account-communications"] || ctx.pathname === selectAccountHref("account-communications")}
      bold={ctx.bold}
    />
  ),
  "maintain-project": (ctx) => (
    <SimpleLink
      href={selectProjectHref("maintain-project")}
      icon={Wrench}
      label={ctx.labelFor("maintain-project", "Project Setup")}
      active={ctx.isMaintaining || ctx.pathname === selectProjectHref("maintain-project")}
      bold={ctx.bold}
    />
  ),
  "view-amend-projects": (ctx) => (
    <SimpleLink
      href={selectProjectHref("view-amend-projects")}
      icon={Eye}
      label={ctx.labelFor("view-amend-projects", "Amend Project")}
      active={ctx.isAmendProject || ctx.pathname === selectProjectHref("view-amend-projects")}
      bold={ctx.bold}
    />
  ),
  "delivery-reporting": (ctx) => (
    <React.Suspense fallback={null}>
      <ReportingLink kind="delivery" ctx={ctx} />
    </React.Suspense>
  ),
  "performance-reporting": (ctx) => (
    <React.Suspense fallback={null}>
      <ReportingLink kind="performance" ctx={ctx} />
    </React.Suspense>
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
    <SimpleLink
      href={selectAccountHref("account-review")}
      icon={ShieldCheck}
      label={ctx.labelFor("account-review", "Account Delivery Status")}
      active={ctx.isAccountReview || ctx.pathname === selectAccountHref("account-review")}
      bold={ctx.bold}
    />
  ),
  "account-approval": (ctx) => (
    <SimpleLink
      href="/account-approval"
      icon={CheckCircle2}
      label={ctx.labelFor("account-approval", "Approve Account Delivery Status")}
      active={!!ctx.routeActive["account-approval"]}
      bold={ctx.bold}
    />
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
  "admin-reporting-periods": (ctx) => (
    <SimpleLink
      href="/admin/reporting-periods"
      icon={CalendarDays}
      label="Reporting Periods"
      active={ctx.pathname.startsWith("/admin/reporting-periods")}
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
    <SimpleLink
      href={selectProjectHref("project-review")}
      icon={ClipboardCheck}
      label={ctx.labelFor("project-review", "Project Delivery Status")}
      active={ctx.isProjectReview || ctx.pathname === selectProjectHref("project-review")}
      bold={ctx.bold}
    />
  ),
  "project-approval": (ctx) => (
    <SimpleLink
      href="/project-approval"
      icon={CheckCircle2}
      label={ctx.labelFor("project-approval", "Approve Project Delivery Status")}
      active={!!ctx.routeActive["project-approval"]}
      bold={ctx.bold}
    />
  ),
  "project-performance": (ctx) => (
    <SimpleLink
      href={selectProjectHref("project-performance")}
      icon={ChartColumn}
      label={ctx.labelFor("project-performance", "Project Performance")}
      active={ctx.isProjectPerformance || ctx.pathname === selectProjectHref("project-performance")}
      bold={ctx.bold}
    />
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
    <SimpleLink
      href={selectProjectHref("de-assessment-report")}
      icon={ShieldCheck}
      label={ctx.labelFor("de-assessment-report", "DE Assessment")}
      active={ctx.isDeAssessmentReport || ctx.pathname === selectProjectHref("de-assessment-report")}
      bold={ctx.bold}
    />
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
  "My Worklist": Briefcase,
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
  const { reportingGeos } = usePatchScope();

  // The "review" (one level up) lists — now that every list is already
  // patch-scoped, review and reporting scopes coincide.
  const reviewGeos = reportingGeos;

  const isDashboard = pathname === "/dashboard";
  const isNewProject = pathname.startsWith("/new-project");
  const isProjectReporting = pathname.startsWith("/project-reporting");
  const isAccountCommunications = /^\/account-reporting\/[^/]+\/customer-communications/.test(pathname);
  const isAccountReporting = pathname.startsWith("/account-reporting") && !isAccountCommunications;
  const isGeoReporting = pathname.startsWith("/geo-reporting");
  const isProjectReview = pathname.startsWith("/project-review");
  const isProjectApproval = pathname.startsWith("/project-approval");
  const isProjectPerformance = pathname.startsWith("/project-performance");
  const isAccountReview = pathname.startsWith("/account-review");
  const isAccountApproval = pathname.startsWith("/account-approval");
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
  const reviewProjectId = isProjectReview || isProjectApproval ? pathname.split("/")[2] : undefined;
  const performanceProjectId = isProjectPerformance ? pathname.split("/")[2] : undefined;
  const reviewAccountId = isAccountReview || isAccountApproval ? pathname.split("/")[2] : undefined;
  const reviewGeoId = isGeoReview ? pathname.split("/")[2] : undefined;

  // Remember whichever project screen is open as the "current" project, so the
  // Project Context page offers it (and the recent list) next time — also covers
  // deep links (dashboards, notifications) that skip the Context page.
  const openProjectId =
    (isMaintaining && routeProjectId) ||
    amendProjectId ||
    reportingProjectId ||
    deAssessmentReportProjectId ||
    reviewProjectId ||
    performanceProjectId ||
    undefined;
  const { touch: touchProject } = useProjectContext();
  React.useEffect(() => {
    if (openProjectId) touchProject(openProjectId);
  }, [openProjectId, touchProject]);

  // Same for the account screens (Report Account Status / Account Delivery Status).
  const openAccountId = reportingAccountId || reviewAccountId || undefined;
  const { touch: touchAccount } = useAccountContext();
  React.useEffect(() => {
    if (openAccountId) touchAccount(openAccountId);
  }, [openAccountId, touchAccount]);

  const labelFor = React.useCallback(
    (id: MenuEntryId, fallback: string) =>
      (effectiveRole && MENU_LABEL_OVERRIDES[effectiveRole]?.[id]) ?? fallback,
    [effectiveRole]
  );

  const routeActive: Partial<Record<MenuEntryId, boolean>> = {
    "maintain-project": isMaintaining,
    "view-amend-projects": isAmendProject,
    "delivery-reporting": isProjectReporting,
    "performance-reporting": isProjectReporting,
    "de-assessment-report": isDeAssessmentReport,
    "project-review": isProjectReview,
    "project-approval": isProjectApproval,
    "project-performance": isProjectPerformance,
    "account-review": isAccountReview,
    "account-approval": isAccountApproval,
    "geo-review": isGeoReview,
    "account-reporting": isAccountReporting,
    "account-communications": isAccountCommunications,
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
    isAmendProject,
    isProjectReporting,
    isDeAssessmentReport,
    isAccountReporting,
    isGeoReporting,
    reportingGeoId,
    isProjectReview,
    isProjectPerformance,
    isAccountReview,
    isGeoReview,
    reviewGeoId,
    reviewGeos,
    reportingGeos,
  };

  const sections = effectiveRole ? (ROLE_MENU_SECTIONS[effectiveRole] ?? []) : [];

  return (
    <aside className="w-64 shrink-0 bg-[#174F7E] py-6">
      <nav className="flex flex-col gap-2 px-3">
        {sections.map((section, index) => {
          // Items directly under a heading ("My Worklist"/"My Reports")
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
