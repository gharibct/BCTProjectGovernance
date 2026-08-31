import type { RoleCode } from "@/lib/api/auth";

// Which sidebar entries each role sees, and where their login lands them.
// Admin's set is the union of everyone else's (see docs/ux-requirements.md
// §5 — role-aware navigation — and the plan behind this file).
export type MenuEntryId =
  | "dashboard"
  | "new-project"
  | "maintain-project"
  | "view-amend-projects"
  | "project-reporting"
  | "system-health"
  | "admin-dashboard"
  | "cxo-dashboard"
  | "project-health"
  | "account-manager-dashboard"
  | "geo-head-dashboard"
  | "project-manager-dashboard"
  | "delivery-excellence-dashboard"
  | "de-assessment"
  | "de-allocation"
  | "de-approval"
  | "pmo-dashboard"
  | "account-reporting"
  | "geo-reporting"
  | "project-review"
  | "account-review"
  | "geo-review"
  | "admin-users-roles"
  | "admin-integrations";

const PROJECT_MANAGER_MENU: MenuEntryId[] = [
  "project-manager-dashboard",
  "project-review",
  "new-project",
  "maintain-project",
  "project-reporting",
  "view-amend-projects",
];

const DASHBOARD_ONLY_MENU: MenuEntryId[] = ["dashboard"];

export const ROLE_MENUS: Record<RoleCode, MenuEntryId[]> = {
  PROJECT_MANAGER: PROJECT_MANAGER_MENU,
  TEAM_MEMBER: DASHBOARD_ONLY_MENU,
  DELIVERY_EXCELLENCE: ["delivery-excellence-dashboard", "de-allocation", "de-approval", "de-assessment"],
  // No PMO login exists yet — this is wired the same way as every other
  // role's My Summary, ready for when a PMO user can sign in (see
  // pmo-my-summary.tsx).
  PMO: ["pmo-dashboard", "project-health"],
  ACCOUNT_MANAGER: ["account-manager-dashboard", "account-review", "account-reporting", "project-review"],
  GEO_HEAD: ["geo-head-dashboard", "geo-review", "geo-reporting", "account-review"],
  CXO: ["cxo-dashboard", "project-health", "geo-review"],
  ADMIN: [
    "admin-dashboard",
    "cxo-dashboard",
    "project-health",
    "account-manager-dashboard",
    "geo-head-dashboard",
    "project-manager-dashboard",
    "delivery-excellence-dashboard",
    "de-allocation",
    "de-approval",
    "de-assessment",
    "pmo-dashboard",
    "account-reporting",
    "geo-reporting",
    "project-review",
    "account-review",
    "geo-review",
    "new-project",
    "maintain-project",
    "project-reporting",
    "view-amend-projects",
    "system-health",
    "admin-users-roles",
    "admin-integrations",
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
  CXO: "/dashboard/cxo",
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
};

export const WORK_CONTEXT_LABEL: Record<RoleCode, string> = {
  PROJECT_MANAGER: "PM",
  ACCOUNT_MANAGER: "Account Head",
  GEO_HEAD: "Geo Head",
  CXO: "CXO",
  TEAM_MEMBER: "Team Member",
  DELIVERY_EXCELLENCE: "Delivery Excellence",
  PMO: "PMO",
  ADMIN: "Admin",
};
