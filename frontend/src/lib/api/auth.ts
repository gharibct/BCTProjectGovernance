import { useMutation, useQuery } from "@tanstack/react-query";

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

// Matches backend Settings.auth_type (app/core/config.py).
export type AuthType = "no_password" | "onelogin";

// Lets the login page know which login UI to render without a rebuild — see
// GET /auth/config in backend/app/api/v1/endpoints/auth.py.
export function useAuthConfig() {
  return useQuery({
    queryKey: ["auth-config"],
    queryFn: () => api.get<{ auth_type: AuthType }>("/auth/config"),
    staleTime: Infinity,
  });
}

// No password check — dev-only fallback path (auth_type="no_password"); the
// identifier (ldap_username or email) just has to resolve to an active user
// (see backend/app/api/v1/endpoints/auth.py). Disabled server-side once
// auth_type="onelogin".
export function useLogin() {
  return useMutation({
    mutationFn: (identifier: string) => api.post<SessionUser>("/auth/login", { identifier }),
  });
}

// Fetches the current session from the backend's session cookie — used after
// the OneLogin redirect lands back in the app (see app/login/callback) since
// that flow never goes through useLogin()'s response body.
export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ["auth-me"],
    queryFn: () => api.get<SessionUser>("/auth/me"),
    enabled,
    retry: false,
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api.post<{ logout_url: string | null }>("/auth/logout"),
  });
}
