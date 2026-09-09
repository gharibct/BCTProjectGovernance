import type { RoleCode } from "@/lib/api/auth";

// Mirrors the backend role gate on /reassignment (reassignment.py's
// _reassigner): only a Geo Head, Account Head, Delivery Excellence, or Admin
// user may open the Reassign Owners screen and change a Project Manager /
// Account Manager / Geo Head. Everyone else has no sidebar entry
// (menu-config.ts) and gets a 403 from the API. An Account Head is scoped to
// their own accounts and does not get the Geo Head tab.
const REASSIGN_ROLES: readonly RoleCode[] = [
  "GEO_HEAD",
  "ACCOUNT_MANAGER",
  "DELIVERY_EXCELLENCE",
  "ADMIN",
];

// The Geo Head tab is hidden for an Account Head (backend returns [] for
// GET /reassignment/geos and 403s the PATCH).
export function canReassignGeoHead(roleCode: RoleCode | undefined): boolean {
  return canReassignOwners(roleCode) && roleCode !== "ACCOUNT_MANAGER";
}

export function canReassignOwners(roleCode: RoleCode | undefined): boolean {
  return roleCode !== undefined && REASSIGN_ROLES.includes(roleCode);
}
