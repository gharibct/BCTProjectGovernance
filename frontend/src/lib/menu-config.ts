import type { RoleCode } from "@/lib/api/auth";

// Which sidebar entries each role sees, and where their login lands them.
// Admin's set is the union of everyone else's (see docs/ux-requirements.md
// §5 — role-aware navigation — and the plan behind this file).
export type MenuEntryId =
  | "dashboard"
  | "new-project"
  | "maintain-project"
  | "project-reporting"
  | "system-health"
  | "admin-dashboard"
  | "cxo-dashboard"
  | "account-manager-dashboard"
  | "geo-head-dashboard"
  | "account-reporting"
  | "geo-reporting"
  | "project-review"
  | "account-review"
  | "geo-review"
  | "admin-users-roles"
  | "admin-integrations";

const PROJECT_MANAGER_MENU: MenuEntryId[] = [
  "dashboard",
  "new-project",
  "maintain-project",
  "project-reporting",
  "system-health",
];

const DASHBOARD_ONLY_MENU: MenuEntryId[] = ["dashboard"];

export const ROLE_MENUS: Record<RoleCode, MenuEntryId[]> = {
  PROJECT_MANAGER: PROJECT_MANAGER_MENU,
  TEAM_MEMBER: DASHBOARD_ONLY_MENU,
  DELIVERY_EXCELLENCE: DASHBOARD_ONLY_MENU,
  PMO: DASHBOARD_ONLY_MENU,
  ACCOUNT_MANAGER: ["account-manager-dashboard", "account-reporting", "project-review"],
  GEO_HEAD: ["geo-head-dashboard", "geo-reporting", "account-review"],
  CXO: ["cxo-dashboard", "geo-review"],
  ADMIN: [
    "admin-dashboard",
    "cxo-dashboard",
    "account-manager-dashboard",
    "geo-head-dashboard",
    "account-reporting",
    "geo-reporting",
    "project-review",
    "account-review",
    "geo-review",
    "new-project",
    "maintain-project",
    "project-reporting",
    "system-health",
    "admin-users-roles",
    "admin-integrations",
  ],
};

// Where a successful login sends each role — the first/primary item in
// their menu.
export const ROLE_LANDING_ROUTE: Record<RoleCode, string> = {
  PROJECT_MANAGER: "/dashboard",
  TEAM_MEMBER: "/dashboard",
  DELIVERY_EXCELLENCE: "/dashboard",
  PMO: "/dashboard",
  ACCOUNT_MANAGER: "/dashboard/account-manager",
  GEO_HEAD: "/dashboard/geo-head",
  CXO: "/dashboard/cxo",
  ADMIN: "/dashboard/admin",
};
