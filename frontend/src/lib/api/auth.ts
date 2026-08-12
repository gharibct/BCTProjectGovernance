import { useMutation } from "@tanstack/react-query";

import { api } from "./client";
import type { SessionUser } from "@/stores/session";

// Matches backend/app/schemas/enums.py's RoleCode.
export type RoleCode =
  | "ADMIN"
  | "CXO"
  | "ACCOUNT_MANAGER"
  | "GEO_HEAD"
  | "PROJECT_MANAGER"
  | "TEAM_MEMBER"
  | "DELIVERY_EXCELLENCE"
  | "PMO";

// No password check — this prototype has no auth system yet; the identifier
// (ldap_username or email) just has to resolve to an active user (see
// backend/app/api/v1/endpoints/auth.py).
export function useLogin() {
  return useMutation({
    mutationFn: (identifier: string) => api.post<SessionUser>("/auth/login", { identifier }),
  });
}
