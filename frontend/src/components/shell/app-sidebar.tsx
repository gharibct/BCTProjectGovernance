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
  FolderOpen,
  Globe,
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
  "flex items-center gap-3.5 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors";
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
// onward (Approved/Hold/Closed/Open Only for Billing) is what charter-form's
// Approve button produces and is what Project Reporting reports on.
function isApproved(status: Project["project_status"]): boolean {
  return status !== "Draft" && status !== "Pending Approval";
}

export function AppSidebar() {
  const pathname = usePathname();
  const user = useSession((s) => s.user);

  const { data: projects = [] } = useProjects();
  const maintainProjects = projects.filter((p) => !isApproved(p.project_status));
  const reportingProjects = projects.filter((p) => isApproved(p.project_status));

  // Admin sees every account/geo; Account Manager/Geo Head see only the
  // ones they're mapped to (session.user.account_ids/geo_ids — see
  // stores/session.ts, populated at login from user_accounts/user_geos).
  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();
  const isAdmin = user?.role.code === "ADMIN";
  const reportingAccounts = isAdmin ? accounts : accounts.filter((a) => user?.account_ids.includes(a.id));
  const reportingGeos = isAdmin ? geos : geos.filter((g) => user?.geo_ids.includes(g.id));

  // Review lists are scoped one level up the org hierarchy from Reporting:
  // Account Heads review their accounts' projects, Geo Heads review their
  // geos' accounts, CXO reviews every geo (no scope restriction, same
  // precedent as services/dashboard.py's DashboardFilters).
  const reviewProjects = isAdmin
    ? reportingProjects
    : projects.filter(
        (p) => isApproved(p.project_status) && !!p.account_id && user?.account_ids.includes(p.account_id)
      );
  const reviewAccounts = isAdmin ? accounts : accounts.filter((a) => !!a.geo_id && user?.geo_ids.includes(a.geo_id));
  const reviewGeos = geos;

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
  // /project-reporting/{projectId}(/...) — every project-reporting route is
  // nested under a :projectId segment, including the hub page itself.
  const reportingProjectId = isProjectReporting ? pathname.split("/")[2] : undefined;
  const reportingAccountId = isAccountReporting ? pathname.split("/")[2] : undefined;
  const reportingGeoId = isGeoReporting ? pathname.split("/")[2] : undefined;
  const reviewProjectId = isProjectReview ? pathname.split("/")[2] : undefined;
  const reviewAccountId = isAccountReview ? pathname.split("/")[2] : undefined;
  const reviewGeoId = isGeoReview ? pathname.split("/")[2] : undefined;

  // AppSidebar only renders once AuthGuard has confirmed a signed-in user, so
  // this is here purely as a defensive fallback (e.g. mid-sign-out render).
  const menu: MenuEntryId[] = user ? (ROLE_MENUS[user.role.code] ?? []) : [];
  const has = (id: MenuEntryId) => menu.includes(id);

  return (
    <aside className="w-64 shrink-0 bg-[#1a4a7a] py-6">
      <nav className="flex flex-col gap-2 px-3">
        {has("dashboard") ? (
          <SimpleLink href="/dashboard" icon={LayoutGrid} label="Dashboard" active={isDashboard} />
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
            label="CXO Dashboard"
            active={pathname === "/dashboard/cxo"}
          />
        ) : null}
        {has("account-manager-dashboard") ? (
          <SimpleLink
            href="/dashboard/account-manager"
            icon={LayoutGrid}
            label="Account Manager Dashboard"
            active={pathname === "/dashboard/account-manager"}
          />
        ) : null}
        {has("geo-head-dashboard") ? (
          <SimpleLink
            href="/dashboard/geo-head"
            icon={LayoutGrid}
            label="Geo Head Dashboard"
            active={pathname === "/dashboard/geo-head"}
          />
        ) : null}

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

        {has("new-project") ? (
          <SimpleLink
            href="/new-project/new/project-charter"
            icon={Plus}
            label="New Project"
            active={isNewProject && !isMaintaining}
          />
        ) : null}

        {has("maintain-project") ? (
          <CollapsibleGroup
            icon={Wrench}
            label="Maintain Project"
            active={isMaintaining}
            defaultOpen={isMaintaining}
          >
            {maintainProjects.map((project) => {
              const active = isMaintaining && project.id === routeProjectId;
              const href = `/new-project/${project.id}/project-charter`;
              return (
                <Link
                  key={project.id}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block w-full rounded-md px-3 py-2 text-left font-mono text-[13px] transition-colors",
                    active
                      ? "bg-white/15 font-semibold text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {project.project_code}
                </Link>
              );
            })}
            {maintainProjects.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-slate-400">No projects yet.</p>
            ) : null}
          </CollapsibleGroup>
        ) : null}

        {has("project-reporting") ? (
          <CollapsibleGroup
            icon={FolderOpen}
            label="Project Reporting"
            active={isProjectReporting}
            defaultOpen={isProjectReporting}
          >
            {reportingProjects.map((project) => {
              const active = project.id === reportingProjectId;
              const href = `/project-reporting/${project.id}`;
              return (
                <Link
                  key={project.id}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block w-full rounded-md px-3 py-2 text-left font-mono text-[13px] transition-colors",
                    active
                      ? "bg-white/15 font-semibold text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {project.project_code}
                </Link>
              );
            })}
            {reportingProjects.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-slate-400">No approved projects yet.</p>
            ) : null}
          </CollapsibleGroup>
        ) : null}

        {has("project-review") ? (
          <CollapsibleGroup
            icon={ClipboardCheck}
            label="Project Review"
            active={isProjectReview}
            defaultOpen={isProjectReview}
          >
            {reviewProjects.map((project) => {
              const active = project.id === reviewProjectId;
              const href = `/project-review/${project.id}`;
              return (
                <Link
                  key={project.id}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block w-full rounded-md px-3 py-2 text-left font-mono text-[13px] transition-colors",
                    active
                      ? "bg-white/15 font-semibold text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {project.project_code}
                </Link>
              );
            })}
            {reviewProjects.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-slate-400">No projects to review yet.</p>
            ) : null}
          </CollapsibleGroup>
        ) : null}

        {has("account-review") ? (
          <CollapsibleGroup
            icon={ShieldCheck}
            label="Account Review"
            active={isAccountReview}
            defaultOpen={isAccountReview}
          >
            {reviewAccounts.map((account) => {
              const active = account.id === reviewAccountId;
              return (
                <Link
                  key={account.id}
                  href={`/account-review/${account.id}`}
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
            {reviewAccounts.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-slate-400">No accounts to review yet.</p>
            ) : null}
          </CollapsibleGroup>
        ) : null}

        {has("geo-review") ? (
          <CollapsibleGroup icon={CheckCircle2} label="Geo Review" active={isGeoReview} defaultOpen={isGeoReview}>
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
      </nav>
    </aside>
  );
}
