import type { RoleCode } from "@/lib/api/auth";

// Which sidebar entries each role sees, and where their login lands them.
// Admin keeps only the admin-specific screens (plus PMO, which has no
// Work-as option). Everything owned by PM / Account Head / Geo Head / DE /
// CDO is reached by switching the top-bar "Work as" combo to that role —
// see WORK_CONTEXTS below (and docs/ux-requirements.md §5).
export type MenuEntryId =
  | "dashboard"
  | "pm-findings"
  | "new-project"
  | "maintain-project"
  | "view-amend-projects"
  | "project-reporting"
  | "de-assessment-report"
  | "admin-dashboard"
  | "cdo-dashboard"
  | "project-health"
  | "account-manager-dashboard"
  | "geo-head-dashboard"
  | "project-manager-dashboard"
  | "delivery-excellence-dashboard"
  | "de-assessment"
  | "de-findings"
  | "de-projects"
  | "de-allocation"
  | "de-approval"
  | "de-project-requests"
  | "reassignment"
  | "pmo-dashboard"
  | "account-reporting"
  | "geo-reporting"
  | "project-review"
  | "project-performance"
  | "actions"
  | "account-review"
  | "geo-review"
  | "admin-users-roles"
  | "admin-integrations"
  | "admin-regions"
  | "admin-exchange-rates"
  | "admin-bulk-projects"
  | "admin-bulk-status-projects"
  | "admin-bulk-status-accounts";

const PROJECT_MANAGER_MENU: MenuEntryId[] = [
  "project-manager-dashboard",
  "project-review",
  // "new-project" (Create Project) moved to Account Head / Geo Head — a project
  // now starts as a creation request they submit and Delivery Excellence
  // approves. The PM picks it up from "Provide Project Details" once approved.
  "maintain-project",
  "project-reporting",
  // Read-only — the DE Assessment workspace itself already renders every
  // field disabled for a PM (see de-assessment-workspace.tsx); this just
  // gives PM a proper entry point, listing the same projects as
  // "project-reporting".
  "de-assessment-report",
  "view-amend-projects",
  // View-only monthly Measurements/Commitments/Payment Milestones/RAIDO
  // rollup — same /project-performance route the Account Manager uses (see
  // app-sidebar.tsx), no review/approval process, unlike project-review above.
  "project-performance",
  // Standalone Level+Value Actions screen (frontend/src/components/actions/
  // actions-view.tsx) — PM only ever gets Project as a Level (see
  // action-permissions.ts's actionLevelsForRole).
  "actions",
  // Rendered last in the sidebar (after "Delivery Status Report - Project") — see app-sidebar.tsx.
  "pm-findings",
];

const DASHBOARD_ONLY_MENU: MenuEntryId[] = ["dashboard"];

export const ROLE_MENUS: Record<RoleCode, MenuEntryId[]> = {
  PROJECT_MANAGER: PROJECT_MANAGER_MENU,
  TEAM_MEMBER: DASHBOARD_ONLY_MENU,
  DELIVERY_EXCELLENCE: [
    "delivery-excellence-dashboard",
    "de-project-requests",
    "de-allocation",
    "de-approval",
    "de-assessment",
    "de-findings",
    "de-projects",
    "reassignment",
    "project-health",
  ],
  // No PMO login exists yet — this is wired the same way as every other
  // role's My Summary, ready for when a PMO user can sign in (see
  // pmo-my-summary.tsx).
  PMO: ["pmo-dashboard", "project-health"],
  ACCOUNT_MANAGER: [
    "account-manager-dashboard",
    "new-project",
    "account-review",
    "account-reporting",
    "project-review",
    // View-only monthly Measurements/Commitments/Payment Milestones/RAIDO
    // rollup — no review/approval process, unlike project-review above.
    "project-performance",
    // Standalone Level+Value Actions screen — Account Manager gets Account
    // and Project as Levels (see action-permissions.ts's actionLevelsForRole).
    "actions",
    // Rendered last in the sidebar — see app-sidebar.tsx.
    "reassignment",
  ],
  GEO_HEAD: [
    "geo-head-dashboard",
    "new-project",
    "geo-review",
    "geo-reporting",
    "account-review",
    // Standalone Level+Value Actions screen — Geo Head gets all three Levels
    // (see action-permissions.ts's actionLevelsForRole).
    "actions",
    // Rendered last in the sidebar — see app-sidebar.tsx.
    "reassignment",
  ],
  // Standalone Level+Value Actions screen — CDO gets all three Levels too
  // (see action-permissions.ts's actionLevelsForRole).
  CDO: ["cdo-dashboard", "project-health", "geo-review", "actions"],
  // Admin-only screens. Everything else (PM / Account Head / Geo Head / DE /
  // CDO work) is reached via the top-bar "Work as" combo — see WORK_CONTEXTS.
  ADMIN: [
    "admin-dashboard",
    "pmo-dashboard",
    "admin-users-roles",
    "admin-integrations",
    "admin-regions",
    "admin-exchange-rates",
    "admin-bulk-projects",
    "admin-bulk-status-projects",
    "admin-bulk-status-accounts",
    // Reassign Owners is reachable org-wide for Admin without a "Work as"
    // switch. Rendered last in the sidebar — see app-sidebar.tsx.
    "reassignment",
  ],
};

// Where a successful login sends each role — the first/primary item in
// their menu. Also where the top-bar Work Context switch navigates to
// (ROLE_LANDING_ROUTE[effectiveRole]).
export const ROLE_LANDING_ROUTE: Record<RoleCode, string> = {
  PROJECT_MANAGER: "/dashboard/project-manager",
  TEAM_MEMBER: "/dashboard",
  DELIVERY_EXCELLENCE: "/dashboard/delivery-excellence",
  PMO: "/dashboard/pmo",
  ACCOUNT_MANAGER: "/dashboard/account-manager",
  GEO_HEAD: "/dashboard/geo-head",
  CDO: "/dashboard/cdo",
  ADMIN: "/dashboard/admin",
};

// Which lower roles each role may "act as" via the top-bar Work Context combo.
// The first entry is that role's own role — the default when workContext is null.
// Roles not listed here get no combo. The backend independently permits an
// Account/Geo Head to do the lower role's writes within their own accounts/geo
// (see backend require_project_access / require_account_or_geo_scope), so this
// map only drives the menu + list scoping + landing route on the client.
export const WORK_CONTEXTS: Partial<Record<RoleCode, RoleCode[]>> = {
  ACCOUNT_MANAGER: ["ACCOUNT_MANAGER", "PROJECT_MANAGER"],
  GEO_HEAD: ["GEO_HEAD", "ACCOUNT_MANAGER", "PROJECT_MANAGER"],
  ADMIN: [
    "ADMIN",
    "PROJECT_MANAGER",
    "ACCOUNT_MANAGER",
    "GEO_HEAD",
    "DELIVERY_EXCELLENCE",
    "CDO",
  ],
};

export const WORK_CONTEXT_LABEL: Record<RoleCode, string> = {
  PROJECT_MANAGER: "PM",
  ACCOUNT_MANAGER: "Account Manager",
  GEO_HEAD: "Geo Head",
  CDO: "CDO",
  TEAM_MEMBER: "Team Member",
  DELIVERY_EXCELLENCE: "DE",
  PMO: "PMO",
  ADMIN: "Admin",
};
