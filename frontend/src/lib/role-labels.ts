// Display name of the ACCOUNT_MANAGER role. The role code (ACCOUNT_MANAGER), its
// routes and API fields keep their internal names; only what the user reads
// comes from here, so renaming the role again means editing this file (and
// backend/app/core/labels.py, which owns the value stored on RAID escalation
// levels and the role name seeded into the roles table).
export const ACCOUNT_MANAGER_LABEL = "Delivery Manager";
export const ACCOUNT_MANAGER_LABEL_PLURAL = "Delivery Managers";

// Role name for display. The roles table may still hold the old
// "Account Manager" name, so the label is applied by code, not trusted from the API.
export function roleDisplayName(role: { code: string; name: string }): string {
  return role.code === "ACCOUNT_MANAGER" ? ACCOUNT_MANAGER_LABEL : role.name;
}
