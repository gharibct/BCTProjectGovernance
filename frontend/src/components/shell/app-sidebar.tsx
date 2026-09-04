"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChartColumn,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Eye,
  FileSearch,
  FolderOpen,
  Globe,
  HeartPulse,
  LayoutGrid,
  Plug,
  Plus,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { NEW_PROJECT_SEGMENT } from "@/stores/new-project-ui";
import { useProjects, type Project } from "@/lib/api/projects";
import { useAccounts, useGeos } from "@/lib/api/reference-data";
import { ROLE_MENUS, type MenuEntryId } from "@/lib/menu-config";
import { useSession } from "@/stores/session";

const itemClass =
  "flex w-full items-center justify-start gap-3.5 rounded-lg px-4 py-2.5 text-left text-[13px] font-semibold text-white transition-colors";
const activeClass = "bg-[#3f8ce0]";
const idleClass = "hover:bg-white/10";

function CollapsibleGroup({
  icon: Icon,
  label,
  active,
  children,
  defaultOpen,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  children: React.ReactNode;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(itemClass, "w-full justify-between", active ? activeClass : idleClass)}
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
        <div className="mt-1 mb-1 ml-6 flex flex-col gap-0.5 border-l border-white/15 pl-3">
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
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(itemClass, active ? activeClass : idleClass)}
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
    return <p className="px-3 py-2 text-[13px] text-slate-400">{emptyLabel}</p>;
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
              "block w-full truncate rounded-md px-3 py-2 text-left text-[13px] transition-colors",
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
          className="px-3 py-2 text-left text-[13px] font-semibold text-slate-400 transition-colors hover:text-white"
        >
          … {hiddenCount} more …
        </button>
      ) : null}
      {showAll && sorted.length > RECENT_LIMIT ? (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="px-3 py-2 text-left text-[13px] font-semibold text-slate-400 transition-colors hover:text-white"
        >
          Show less
        </button>
      ) : null}
    </>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const user = useSession((s) => s.user);
  const workContext = useSession((s) => s.workContext);

  const { data: projects = [] } = useProjects();
  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();

  // The role whose menu applies right now: the chosen Work Context, else the
  // real role. `realRole` still governs which accounts/projects the user may
  // touch — a Geo Head "acting as PM" is still bounded by their own geo(s).
  const realRole = user?.role.code;
  const effectiveRole = workContext ?? realRole;
  const isAdmin = realRole === "ADMIN";

  // The user's real patch — the accounts / geo(s) / projects they own,
  // independent of the chosen context (Geo Head: everything in their geo;
  // Account Head: their accounts; PM/Admin: everything).
  const patchGeoIds = React.useMemo(
    () => new Set(realRole === "GEO_HEAD" ? (user?.geo_ids ?? []) : []),
    [realRole, user]
  );
  const patchAccountIds = React.useMemo<Set<string> | null>(() => {
    if (isAdmin) return null; // null = every account
    if (realRole === "GEO_HEAD")
      return new Set(accounts.filter((a) => a.geo_id && patchGeoIds.has(a.geo_id)).map((a) => a.id));
    return new Set(user?.account_ids ?? []);
  }, [isAdmin, realRole, user, accounts, patchGeoIds]);
  const patchProjects = React.useMemo(() => {
    if (isAdmin || realRole === "PROJECT_MANAGER") return projects;
    return projects.filter(
      (p) =>
        (!!p.account_id && !!patchAccountIds && patchAccountIds.has(p.account_id)) ||
        (!!p.geo_id && patchGeoIds.has(p.geo_id))
    );
  }, [projects, isAdmin, realRole, patchAccountIds, patchGeoIds]);

  const maintainProjects = patchProjects.filter((p) => !isApproved(p.project_status));
  const reportingProjects = patchProjects.filter((p) => isApproved(p.project_status));
  const statusReportProjects = patchProjects.filter((p) => canReport(p.project_status));

  const inPatchAccounts = (id: string | null | undefined) =>
    !id ? false : patchAccountIds === null || patchAccountIds.has(id);
  const reportingAccounts = isAdmin ? accounts : accounts.filter((a) => inPatchAccounts(a.id));
  const reportingGeos =
    isAdmin || realRole === "CXO" ? geos : geos.filter((g) => patchGeoIds.has(g.id));

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
  const reportingAccountId = isAccountReporting ? pathname.split("/")[2] : undefined;
  const reportingGeoId = isGeoReporting ? pathname.split("/")[2] : undefined;
  const reviewProjectId = isProjectReview ? pathname.split("/")[2] : undefined;
  const reviewAccountId = isAccountReview ? pathname.split("/")[2] : undefined;
  const reviewGeoId = isGeoReview ? pathname.split("/")[2] : undefined;

  // The menu follows the effective (Work Context) role. AppSidebar only renders
  // once AuthGuard has confirmed a signed-in user, so the `?? []` is a
  // defensive fallback (e.g. mid-sign-out render).
  const menu: MenuEntryId[] = effectiveRole ? (ROLE_MENUS[effectiveRole] ?? []) : [];
  const has = (id: MenuEntryId) => menu.includes(id);

  // Geo Head wants "Account Dashboard" below "Geo Reporting" instead of
  // grouped with the other one-click Dashboard shortcuts up top (where every
  // other role that has it — Account Manager, Admin — keeps it).
  const accountDashboardGroup = (
    <CollapsibleGroup icon={ShieldCheck} label="Account Dashboard" active={isAccountReview} defaultOpen={isAccountReview}>
      {reviewAccounts.map((account) => {
        const active = account.id === reviewAccountId;
        return (
          <Link
            key={account.id}
            href={`/account-review/${account.id}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors",
              active ? "bg-white/15 font-semibold text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
            )}
          >
            {account.name}
          </Link>
        );
      })}
      {reviewAccounts.length === 0 ? (
        <p className="px-3 py-2 text-[13px] text-slate-400">No accounts to review yet.</p>
      ) : null}
    </CollapsibleGroup>
  );
  const isGeoHead = effectiveRole === "GEO_HEAD";

  // Account Manager and Project Manager want "Project Dashboard" last instead
  // of grouped with the other one-click Dashboard shortcuts up top (where
  // Admin keeps it).
  const projectDashboardGroup = (
    <CollapsibleGroup icon={ClipboardCheck} label="Project Dashboard" active={isProjectReview} defaultOpen={isProjectReview}>
      <ProjectNavList
        projects={reviewProjects}
        activeId={reviewProjectId}
        hrefFor={(project) => `/project-review/${project.id}`}
        emptyLabel="No projects to review yet."
      />
    </CollapsibleGroup>
  );
  const isAccountManager = effectiveRole === "ACCOUNT_MANAGER";
  // Project Manager also wants "Project Dashboard" last — see the Account
  // Manager comment above the group's definition.
  const isProjectManager = effectiveRole === "PROJECT_MANAGER";

  return (
    <aside className="w-64 shrink-0 bg-[#1a4a7a] py-6">
      <nav className="flex flex-col gap-2 px-3">
        {has("dashboard") ? (
          <SimpleLink href="/dashboard" icon={LayoutGrid} label="My Summary" active={isDashboard} />
        ) : null}
        {has("project-manager-dashboard") ? (
          <SimpleLink
            href="/dashboard/project-manager"
            icon={LayoutGrid}
            label="My Summary"
            active={pathname === "/dashboard/project-manager"}
          />
        ) : null}
        {has("delivery-excellence-dashboard") ? (
          <SimpleLink
            href="/dashboard/delivery-excellence"
            icon={LayoutGrid}
            label="My Summary"
            active={pathname === "/dashboard/delivery-excellence"}
          />
        ) : null}
        {has("de-allocation") ? (
          <SimpleLink
            href="/de-allocation"
            icon={Users}
            label="DE Allocation"
            active={pathname.startsWith("/de-allocation")}
          />
        ) : null}
        {has("de-approval") ? (
          <SimpleLink
            href="/de-approval"
            icon={ShieldCheck}
            label="DE Approval"
            active={pathname.startsWith("/de-approval")}
          />
        ) : null}
        {has("de-assessment") ? (
          <SimpleLink
            href="/de-assessment"
            icon={ClipboardCheck}
            label="DE Assessment"
            active={pathname.startsWith("/de-assessment")}
          />
        ) : null}
        {has("de-findings") ? (
          <SimpleLink
            href="/de-findings"
            icon={FileSearch}
            label="DE Findings"
            active={pathname.startsWith("/de-findings")}
          />
        ) : null}
        {has("de-projects") ? (
          <SimpleLink
            href="/de-projects"
            icon={FolderOpen}
            label="Projects"
            active={pathname.startsWith("/de-projects")}
          />
        ) : null}
        {has("pmo-dashboard") ? (
          <SimpleLink
            href="/dashboard/pmo"
            icon={LayoutGrid}
            label="My Summary"
            active={pathname === "/dashboard/pmo"}
          />
        ) : null}
        {has("admin-dashboard") ? (
          <SimpleLink
            href="/dashboard/admin"
            icon={LayoutGrid}
            label="Admin Dashboard"
            active={pathname === "/dashboard/admin"}
          />
        ) : null}
        {has("cxo-dashboard") ? (
          <SimpleLink
            href="/dashboard/cxo"
            icon={LayoutGrid}
            label="My Summary"
            active={pathname === "/dashboard/cxo"}
          />
        ) : null}
        {has("project-health") ? (
          <SimpleLink
            href="/project-health"
            icon={HeartPulse}
            label="Project Health"
            active={pathname.startsWith("/project-health")}
          />
        ) : null}
        {has("account-manager-dashboard") ? (
          <SimpleLink
            href="/dashboard/account-manager"
            icon={LayoutGrid}
            label="My Summary"
            active={pathname === "/dashboard/account-manager"}
          />
        ) : null}
        {has("geo-head-dashboard") ? (
          <SimpleLink
            href="/dashboard/geo-head"
            icon={LayoutGrid}
            label="My Summary"
            active={pathname === "/dashboard/geo-head"}
          />
        ) : null}

        {has("new-project") ? (
          <SimpleLink
            href="/new-project/new/create"
            icon={Plus}
            label="Create Project"
            active={isNewProject && !isMaintaining}
          />
        ) : null}

        {has("maintain-project") ? (
          <CollapsibleGroup
            icon={Wrench}
            label="Provide Project Details"
            active={isMaintaining}
            defaultOpen={isMaintaining}
          >
            <ProjectNavList
              projects={maintainProjects}
              activeId={isMaintaining ? routeProjectId : undefined}
              hrefFor={(project) => `/new-project/${project.id}/project-charter`}
              emptyLabel="No projects yet."
            />
          </CollapsibleGroup>
        ) : null}

        {has("view-amend-projects") ? (
          <CollapsibleGroup
            icon={Eye}
            label="Amend Project Details"
            active={isAmendProject}
            defaultOpen={isAmendProject}
          >
            <ProjectNavList
              projects={reportingProjects}
              activeId={amendProjectId}
              hrefFor={(project) => `/amend-project/${project.id}/project-charter`}
              emptyLabel="No approved projects yet."
            />
          </CollapsibleGroup>
        ) : null}

        {has("project-reporting") ? (
          <CollapsibleGroup
            icon={FolderOpen}
            label="Report Project Status"
            active={isProjectReporting}
            defaultOpen={isProjectReporting}
          >
            <ProjectNavList
              projects={statusReportProjects}
              activeId={reportingProjectId}
              hrefFor={(project) => `/project-reporting/${project.id}`}
              emptyLabel="No approved projects yet."
            />
          </CollapsibleGroup>
        ) : null}

        {has("geo-review") ? (
          <CollapsibleGroup icon={CheckCircle2} label="Geo Dashboard" active={isGeoReview} defaultOpen={isGeoReview}>
            {reviewGeos.map((geo) => {
              const active = geo.id === reviewGeoId;
              return (
                <Link
                  key={geo.id}
                  href={`/geo-review/${geo.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors",
                    active
                      ? "bg-white/15 font-semibold text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {geo.name}
                </Link>
              );
            })}
            {reviewGeos.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-slate-400">No geos to review yet.</p>
            ) : null}
          </CollapsibleGroup>
        ) : null}

        {has("account-review") && !isGeoHead ? accountDashboardGroup : null}

        {has("project-review") && !isAccountManager && !isProjectManager ? projectDashboardGroup : null}

        {has("account-reporting") ? (
          <CollapsibleGroup
            icon={Building2}
            label="Account Reporting"
            active={isAccountReporting}
            defaultOpen={isAccountReporting}
          >
            {reportingAccounts.map((account) => {
              const active = account.id === reportingAccountId;
              return (
                <Link
                  key={account.id}
                  href={`/account-reporting/${account.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors",
                    active
                      ? "bg-white/15 font-semibold text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {account.name}
                </Link>
              );
            })}
            {reportingAccounts.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-slate-400">No accounts assigned yet.</p>
            ) : null}
          </CollapsibleGroup>
        ) : null}

        {has("geo-reporting") ? (
          <CollapsibleGroup
            icon={Globe}
            label="Geo Reporting"
            active={isGeoReporting}
            defaultOpen={isGeoReporting}
          >
            {reportingGeos.map((geo) => {
              const active = geo.id === reportingGeoId;
              return (
                <Link
                  key={geo.id}
                  href={`/geo-reporting/${geo.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors",
                    active
                      ? "bg-white/15 font-semibold text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {geo.name}
                </Link>
              );
            })}
            {reportingGeos.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-slate-400">No geos assigned yet.</p>
            ) : null}
          </CollapsibleGroup>
        ) : null}

        {has("account-review") && isGeoHead ? accountDashboardGroup : null}

        {has("system-health") ? (
          <Link href="#" className={cn(itemClass, idleClass)}>
            <ChartColumn className="size-5 shrink-0" />
            System Health
          </Link>
        ) : null}

        {has("admin-users-roles") ? (
          <SimpleLink
            href="/admin/users"
            icon={Users}
            label="Users & Roles"
            active={pathname.startsWith("/admin/users")}
          />
        ) : null}

        {has("admin-integrations") ? (
          <SimpleLink
            href="/admin/accounts"
            icon={Plug}
            label="Accounts"
            active={pathname.startsWith("/admin/accounts")}
          />
        ) : null}

        {has("project-review") && (isAccountManager || isProjectManager) ? projectDashboardGroup : null}

        {has("pm-findings") ? (
          <SimpleLink
            href="/pm-findings"
            icon={FileSearch}
            label="DE Findings"
            active={pathname.startsWith("/pm-findings")}
          />
        ) : null}
      </nav>
    </aside>
  );
}
