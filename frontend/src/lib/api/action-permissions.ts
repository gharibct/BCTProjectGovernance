import type { RoleCode } from "@/lib/api/auth";
import type { Action, ActionLevel } from "@/lib/api/actions";

// Mirrors backend/app/api/v1/endpoints/actions.py's per-level write gate —
// client-side gating is defense in depth only, the server enforces this for
// real. Kept here (not duplicated per component) since v1 had this literal
// array copy-pasted across list/create/detail views.
const WRITE_ROLES: Record<ActionLevel, readonly RoleCode[]> = {
  GEO: ["GEO_HEAD", "CXO", "ADMIN"],
  ACCOUNT: ["ACCOUNT_MANAGER", "GEO_HEAD", "ADMIN"],
  PROJECT: ["PROJECT_MANAGER", "ACCOUNT_MANAGER", "ADMIN"],
};

export function canCreateAction(level: ActionLevel, roleCode: RoleCode | undefined): boolean {
  return !!roleCode && WRITE_ROLES[level].includes(roleCode);
}

// A transition (start/complete/close/cancel/comment) is allowed for the
// action's own assignee regardless of role, or for anyone who'd pass the
// level's write gate — matches actions.py's _owner_or().
export function canTransitionAction(
  level: ActionLevel,
  action: Pick<Action, "action_by_id">,
  userId: string | undefined,
  roleCode: RoleCode | undefined
): boolean {
  if (!!userId && userId === action.action_by_id) return true;
  return canCreateAction(level, roleCode);
}
