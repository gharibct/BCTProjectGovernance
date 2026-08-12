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
  signIn: (user: SessionUser) => void;
  signOut: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
    }),
    { name: "pg-session" }
  )
);
