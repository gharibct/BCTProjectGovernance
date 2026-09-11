import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { SessionUser } from "@/stores/session";

// Matches backend/app/schemas/enums.py's RoleCode.
export type RoleCode =
  | "ADMIN"
  | "CDO"
  | "ACCOUNT_MANAGER"
  | "GEO_HEAD"
  | "PROJECT_MANAGER"
  | "TEAM_MEMBER"
  | "DELIVERY_EXCELLENCE"
  | "PMO";

// Matches backend Settings.auth_type (app/core/config.py).
export type AuthType = "no_password" | "password" | "onelogin";

// Lets the login page know which login UI to render without a rebuild — see
// GET /auth/config in backend/app/api/v1/endpoints/auth.py.
export function useAuthConfig() {
  return useQuery({
    queryKey: ["auth-config"],
    queryFn: () => api.get<{ auth_type: AuthType }>("/auth/config"),
    staleTime: Infinity,
  });
}

// auth_type="no_password": the identifier (ldap_username or email) just has to
// resolve to an active user, `password` is ignored. auth_type="password": the
// identifier + a local password are both checked. Disabled server-side once
// auth_type="onelogin". See backend/app/api/v1/endpoints/auth.py.
export function useLogin() {
  return useMutation({
    mutationFn: ({ identifier, password }: { identifier: string; password?: string }) =>
      api.post<SessionUser>("/auth/login", { identifier, password: password ?? "" }),
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

// Minimum local-password length — mirrors PASSWORD_MIN_LENGTH in
// backend/app/schemas/users.py.
export const PASSWORD_MIN_LENGTH = 8;

// Self-service local-password change, offered in the profile menu. Only
// available under auth_type="password" (the backend re-checks and 403s
// otherwise); requires the current password, unlike the Admin reset.
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      api.post<void>("/auth/change-password", body),
  });
}
