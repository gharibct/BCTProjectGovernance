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

const DASHBOARD_ONLY_MENU: MenuEntryId[] = ["dashboard"];

// A labeled, collapsible group of sidebar items ("My Work", "Project
// Oversight"), or an ungrouped item list when `heading` is omitted (rendered
// bare, same as before this existed). Every RoleCode gets an entry — roles
// out of scope for grouping (ADMIN, PMO, TEAM_MEMBER) just get one
// heading-less section wrapping their flat list, so app-sidebar.tsx has a
// single render path for every role. See docs/ux-requirements.md and the
// left-nav regrouping plan for the source of this shape per role.
export type MenuSection = {
  heading?: string;
  items: MenuEntryId[];
};

export const ROLE_MENU_SECTIONS: Record<RoleCode, MenuSection[]> = {
  PROJECT_MANAGER: [
    { items: ["project-manager-dashboard"] },
    {
      heading: "My Work",
      items: ["maintain-project", "view-amend-projects", "project-reporting"],
    },
    {
      heading: "My Reports",
      items: ["project-review", "project-performance", "de-assessment-report", "pm-findings", "actions"],
    },
  ],
  TEAM_MEMBER: [{ items: DASHBOARD_ONLY_MENU }],
  DELIVERY_EXCELLENCE: [
    { items: ["delivery-excellence-dashboard"] },
    {
      heading: "My Work",
      items: [
        "de-project-requests",
        "de-allocation",
        "de-approval",
        "de-assessment",
        "de-findings",
        "de-projects",
        "reassignment",
      ],
    },
    {
      heading: "My Reports",
      items: ["geo-review", "account-review", "project-review", "project-performance", "actions"],
    },
  ],
  // No PMO login exists yet — this is wired the same way as every other
  // role's My Summary, ready for when a PMO user can sign in (see
  // pmo-my-summary.tsx). Out of scope for grouping.
  PMO: [{ items: ["project-health"] }],
  ACCOUNT_MANAGER: [
    { items: ["account-manager-dashboard"] },
    {
      heading: "My Work",
      items: ["new-project", "account-reporting", "reassignment"],
    },
    {
      heading: "My Reports",
      items: [
        "account-review",
        "project-review",
        "project-performance",
        "de-assessment-report",
        "de-findings",
        "actions",
      ],
    },
    {
      heading: "Team Worklist",
      items: ["maintain-project", "view-amend-projects", "project-reporting"],
    },
  ],
  GEO_HEAD: [
    { items: ["geo-head-dashboard"] },
    {
      heading: "My Work",
      items: ["geo-reporting", "reassignment"],
    },
    {
      heading: "My Reports",
      items: [
        "geo-review",
        "account-review",
        "project-review",
        "project-performance",
        "de-assessment-report",
        "de-findings",
        "actions",
      ],
    },
    {
      heading: "Team Worklist",
      items: [
        "new-project",
        "maintain-project",
        "view-amend-projects",
        "project-reporting",
        "account-reporting",
      ],
    },
  ],
  CDO: [
    { items: ["cdo-dashboard"] },
    {
      heading: "My Reports",
      items: [
        "geo-review",
        "account-review",
        "project-review",
        "project-performance",
        "de-assessment-report",
        "de-findings",
        "actions",
      ],
    },
  ],
  // Admin-only screens. Everything else (PM / Account Head / Geo Head / DE /
  // CDO work) is reached via the top-bar "Work as" combo — see WORK_CONTEXTS.
  // Out of scope for grouping.
  ADMIN: [
    {
      items: [
        "admin-dashboard",
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
    },
  ],
};

// Flat, ordered fallback derived from ROLE_MENU_SECTIONS — kept for any
// caller that just wants "does this role have id X" / "in what order",
// without caring about section grouping.
export const ROLE_MENUS: Record<RoleCode, MenuEntryId[]> = Object.fromEntries(
  Object.entries(ROLE_MENU_SECTIONS).map(([role, sections]) => [
    role,
    sections.flatMap((s) => s.items),
  ])
) as Record<RoleCode, MenuEntryId[]>;

// Per-role label overrides for ids whose display label depends on the
// viewing role — every other id's label is fixed in app-sidebar.tsx's
// MENU_ITEMS registry regardless of role.
export const MENU_LABEL_OVERRIDES: Partial<Record<RoleCode, Partial<Record<MenuEntryId, string>>>> = {
  ACCOUNT_MANAGER: { reassignment: "Assign Role" },
  GEO_HEAD: { reassignment: "Assign Role" },
  DELIVERY_EXCELLENCE: { reassignment: "Assign Role", "de-findings": "Create DE Finding" },
};

// Where a successful login sends each role — the first/primary item in
// their menu. Also where the top-bar Work Context switch navigates to
// (ROLE_LANDING_ROUTE[effectiveRole]).
export const ROLE_LANDING_ROUTE: Record<RoleCode, string> = {
  PROJECT_MANAGER: "/project-health",
  TEAM_MEMBER: "/dashboard",
  DELIVERY_EXCELLENCE: "/project-health",
  PMO: "/project-health",
  ACCOUNT_MANAGER: "/project-health",
  GEO_HEAD: "/project-health",
  CDO: "/project-health",
  ADMIN: "/dashboard/admin",
};

// Which roles each role may "act as" via the top-bar Work Context combo.
// The first entry is that role's own role — the default when workContext is null.
// Roles not listed here get no combo. Only Admin gets one now: Account Manager
// and Geo Head reach the PM-level work through their "Team Worklist" menu
// section instead. The backend independently permits an Account/Geo Head to do
// the lower role's writes within their own accounts/geo (see backend
// require_project_access / require_account_or_geo_scope), so this map only
// drives the menu + list scoping + landing route on the client.
export const WORK_CONTEXTS: Partial<Record<RoleCode, RoleCode[]>> = {
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
