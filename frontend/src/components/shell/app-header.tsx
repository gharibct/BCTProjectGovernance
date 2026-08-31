"use client";

import { useRouter } from "next/navigation";
import { Bell, Briefcase, LayoutGrid, LogOut, Menu } from "lucide-react";

import type { RoleCode } from "@/lib/api/auth";
import { useLogout } from "@/lib/api/auth";
import {
  ROLE_LANDING_ROUTE,
  WORK_CONTEXTS,
  WORK_CONTEXT_LABEL,
} from "@/lib/menu-config";
import { useEffectiveRole, useSession } from "@/stores/session";
import { NativeSelect } from "@/components/ui/native-select";

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AppHeader() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const workContext = useSession((s) => s.workContext);
  const setWorkContext = useSession((s) => s.setWorkContext);
  const effectiveRole = useEffectiveRole();
  const logout = useLogout();

  const contextOptions = user ? WORK_CONTEXTS[user.role.code] : undefined;

  const onContextChange = (value: string) => {
    if (!user) return;
    const next = value === user.role.code ? null : (value as RoleCode);
    setWorkContext(next);
    router.push(ROLE_LANDING_ROUTE[next ?? user.role.code]);
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Toggle menu"
          className="rounded-lg p-2 text-slate-800 hover:bg-slate-100"
        >
          <Menu className="size-6" />
        </button>
        <div className="flex items-center gap-3">
          <LayoutGrid className="size-7 text-[#1a4a7a]" />
          <span className="text-xl font-bold tracking-tight text-[#1a4a7a]">
            Project Governance
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {user && contextOptions ? (
          <label className="flex items-center gap-2 rounded-full bg-blue-50 py-1 pr-1 pl-3 text-sm font-semibold text-[#15406b]">
            <Briefcase className="size-4 shrink-0" />
            <span className="hidden shrink-0 sm:inline">Work as</span>
            <NativeSelect
              aria-label="Work context"
              value={workContext ?? user.role.code}
              onChange={(e) => onContextChange(e.target.value)}
              className="h-8 w-40 rounded-full border-blue-200 bg-white text-sm font-semibold text-[#15406b]"
            >
              {contextOptions.map((role) => (
                <option key={role} value={role}>
                  {WORK_CONTEXT_LABEL[role]}
                </option>
              ))}
            </NativeSelect>
          </label>
        ) : null}

        <button
          type="button"
          aria-label="Notifications"
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
        >
          <Bell className="size-5" />
        </button>
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800">
              {user.full_name} ·{" "}
              {workContext && effectiveRole
                ? `${WORK_CONTEXT_LABEL[effectiveRole]} (acting)`
                : user.role.name}
            </span>
            <div className="flex size-9 items-center justify-center rounded-full bg-[#1a6fc4] text-sm font-semibold text-white">
              {initials(user.full_name)}
            </div>
            <button
              type="button"
              aria-label="Sign out"
              onClick={() => {
                logout.mutate(undefined, {
                  onSettled: (data) => {
                    signOut();
                    if (data?.logout_url) {
                      window.location.href = data.logout_url;
                    } else {
                      router.push("/login");
                    }
                  },
                });
              }}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
