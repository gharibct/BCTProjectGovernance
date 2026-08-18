"use client";

import { useRouter } from "next/navigation";
import { Bell, LayoutGrid, LogOut, Menu } from "lucide-react";

import { useLogout } from "@/lib/api/auth";
import { useSession } from "@/stores/session";

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
  const logout = useLogout();

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
              {user.full_name} · {user.role.name}
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
