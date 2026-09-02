import type { RoleCode } from "@/lib/api/auth";

// Mirrors the backend require_project_de_assessment_access gate on
// /projects/{id}/de-assessments (de_assessment.py): a DE assessment is Delivery
// Excellence's own activity, so only these roles may create/patch an assessment
// or add/update findings. Everyone else sees the workspace read-only.
const WRITE_ROLES: readonly RoleCode[] = ["DELIVERY_EXCELLENCE", "ADMIN"];

export function canWriteDeAssessment(roleCode: RoleCode | undefined): boolean {
  return roleCode !== undefined && WRITE_ROLES.includes(roleCode);
}

// The backend also requires the project to have a DE allocated
// (project.delivery_excellence_id). ADMIN bypasses that check.
export function canAssessProject(
  roleCode: RoleCode | undefined,
  hasDeAllocated: boolean,
): boolean {
  if (!canWriteDeAssessment(roleCode)) return false;
  return roleCode === "ADMIN" || hasDeAllocated;
}
