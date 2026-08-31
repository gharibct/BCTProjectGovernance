"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { RoleCode } from "@/lib/api/auth";

export type SessionRole = {
  id: string;
  code: RoleCode;
  name: string;
  description: string | null;
};

export type SessionUser = {
  id: string;
  ldap_username: string;
  full_name: string;
  email: string;
  role: SessionRole;
  geo_ids: string[];
  account_ids: string[];
};

type SessionState = {
  user: SessionUser | null;
  // Top-bar "Work Context": a higher role (Account/Geo Head) acting as a lower
  // one. null = act as your own role. Cleared on sign-in and sign-out so a
  // persisted context never leaks into a different login (see menu-config.ts
  // WORK_CONTEXTS for which roles may pick which).
  workContext: RoleCode | null;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
  setWorkContext: (role: RoleCode | null) => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      workContext: null,
      signIn: (user) => set({ user, workContext: null }),
      signOut: () => set({ user: null, workContext: null }),
      setWorkContext: (role) => set({ workContext: role }),
    }),
    { name: "pg-session" }
  )
);

// The role whose menu / permissions / scope apply right now: the chosen Work
// Context if any, else the user's real role.
export function useEffectiveRole(): RoleCode | undefined {
  const realRole = useSession((s) => s.user?.role.code);
  const workContext = useSession((s) => s.workContext);
  return workContext ?? realRole;
}
