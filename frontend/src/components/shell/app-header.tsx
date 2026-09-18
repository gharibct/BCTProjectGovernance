"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Briefcase, Menu } from "lucide-react";

import type { RoleCode } from "@/lib/api/auth";
import {
  ROLE_LANDING_ROUTE,
  WORK_CONTEXTS,
  WORK_CONTEXT_LABEL,
} from "@/lib/menu-config";
import { useEffectiveRole, useSession } from "@/stores/session";
import { NativeSelect } from "@/components/ui/native-select";
import { NotificationsBell } from "@/components/shell/notifications-bell";
import { ProfileMenu } from "@/components/shell/profile-menu";

export function AppHeader() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const workContext = useSession((s) => s.workContext);
  const setWorkContext = useSession((s) => s.setWorkContext);
  const effectiveRole = useEffectiveRole();

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
          <Image src="/logo.png" alt="Governance One" width={32} height={32} className="size-8" />
          <div className="flex flex-col leading-tight">
            <span className="text-xl font-bold tracking-tight text-[#1a4a7a]">
              Governance One
            </span>
            <span className="hidden text-[11px] font-medium text-slate-500 sm:block">
              Know Early. Act Early. Deliver Better.
            </span>
          </div>
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

        {user ? <NotificationsBell /> : null}
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800">
              {user.full_name} ·{" "}
              {workContext && effectiveRole
                ? `${WORK_CONTEXT_LABEL[effectiveRole]} (acting)`
                : user.role.name}
            </span>
            <ProfileMenu />
          </div>
        ) : null}
      </div>
    </header>
  );
}
