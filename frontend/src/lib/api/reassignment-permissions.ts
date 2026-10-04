import type { RoleCode } from "@/lib/api/auth";

// Mirrors the backend role gate on /reassignment (reassignment.py's
// _reassigner): only a Geo Head, Account Head, Delivery Excellence, or Admin
// user may open the Reassign Owners screen and change a Project Manager /
// Delivery Manager / Geo Head. Everyone else has no sidebar entry
// (menu-config.ts) and gets a 403 from the API. An Account Head is scoped to
// their own accounts: they may change Project Managers and add / remove proxy
// Delivery Managers, but not the primary Delivery Manager; the Geo Head tab is
// hidden for them.
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

// The Delivery Manager tab is shown to every role on this screen: an Account
// Head sees their own accounts there, to add / remove proxy Delivery Managers.
export function canReassignAccountManager(roleCode: RoleCode | undefined): boolean {
  return canReassignOwners(roleCode);
}

// Changing the *primary* Delivery Manager is not open to an Account Head (the
// backend 403s the PATCH); proxies are.
export function canChangePrimaryAccountManager(roleCode: RoleCode | undefined): boolean {
  return canReassignOwners(roleCode) && roleCode !== "ACCOUNT_MANAGER";
}

export function canReassignOwners(roleCode: RoleCode | undefined): boolean {
  return roleCode !== undefined && REASSIGN_ROLES.includes(roleCode);
}
