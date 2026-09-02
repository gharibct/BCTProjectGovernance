import type { RoleCode } from "@/lib/api/auth";

// Mirrors the backend require_pm_findings_write gate on
// PUT /pm-findings/{id}/action-taken: only a real PM (or ADMIN) can record
// remarks + move a finding to "Awaiting Closure". Everyone else sees the
// drawer read-only.
const ACT_ROLES: readonly RoleCode[] = ["PROJECT_MANAGER", "ADMIN"];

export function canActOnPmFinding(roleCode: RoleCode | undefined): boolean {
  return roleCode !== undefined && ACT_ROLES.includes(roleCode);
}
