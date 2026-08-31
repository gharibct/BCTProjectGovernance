import type { RoleCode } from "@/lib/api/auth";

// Mirrors the backend require_role gate on /de-allocation and /de-approval
// (de_allocation.py / de_approval.py): only Delivery Excellence and Admin may
// allocate projects to a DE or run the governance-approval decision. Everyone
// else has no route to these screens (the sidebar entries are hidden too — see
// menu-config.ts).
const DE_ROLES: readonly RoleCode[] = ["DELIVERY_EXCELLENCE", "ADMIN"];

export function canWriteDeApproval(roleCode: RoleCode | undefined): boolean {
  return roleCode !== undefined && DE_ROLES.includes(roleCode);
}

export function canAllocateDe(roleCode: RoleCode | undefined): boolean {
  return roleCode !== undefined && DE_ROLES.includes(roleCode);
}
