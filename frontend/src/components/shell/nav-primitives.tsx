import { Circle, CircleCheck, type LucideIcon } from "lucide-react";

import { CURRENT_PERIOD } from "@/components/shell/reporting-period-badge";

// Shared shape/pieces for the per-scope right-hand side navs (ProjectNav,
// AccountNav, ...) — each item is its own route so the browser URL, back
// button, and active state all agree. `done` marks whether the task is
// completed for the current reporting period (sample values until there's
// a backend).
export type NavItem = {
  label: string;
  href: string;
  done: boolean;
};

export type NavGroup = {
  heading: string;
  icon: LucideIcon;
  items: NavItem[];
};

export const childClass =
  "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors";
export const activeClass = "bg-[#d9eafc] font-bold text-[#15406b]";
export const idleClass = "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900";

export function StatusIcon({ done }: { done: boolean }) {
  const title = done ? `Completed for ${CURRENT_PERIOD}` : `Pending for ${CURRENT_PERIOD}`;
  return done ? (
    <CircleCheck className="size-4 shrink-0 text-emerald-500">
      <title>{title}</title>
    </CircleCheck>
  ) : (
    <Circle className="size-4 shrink-0 text-slate-300">
      <title>{title}</title>
    </Circle>
  );
}
