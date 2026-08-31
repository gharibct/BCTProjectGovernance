import type { RoleCode } from "@/lib/api/auth";

// Mirrors the backend _write_roles gate on /projects/{id}/de-assessments
// (de_assessment.py): only these roles may create/patch an assessment or
// add/update findings. Everyone else sees the workspace read-only.
const WRITE_ROLES: readonly RoleCode[] = ["DELIVERY_EXCELLENCE", "PROJECT_MANAGER", "ADMIN"];

export function canWriteDeAssessment(roleCode: RoleCode | undefined): boolean {
  return roleCode !== undefined && WRITE_ROLES.includes(roleCode);
}
