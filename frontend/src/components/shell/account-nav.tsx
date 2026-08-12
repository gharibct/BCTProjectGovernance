"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { CalendarDays, Circle, CircleCheck, ClipboardList, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { CURRENT_PERIOD } from "@/components/shell/reporting-period-badge";
import { activeClass, childClass, idleClass, StatusIcon, type NavGroup } from "./nav-primitives";

// Mirrors project-nav.tsx's shell exactly, generalized for Account
// Reporting. Unlike Project's nav, there's no Weekly-only filtering here —
// Account Reporting shows the same menu for both Weekly and Monthly.
function buildGroups(base: string): NavGroup[] {
  return [
    {
      heading: "Account Reporting",
      icon: ClipboardList,
      items: [
        { label: "Account Reporting", href: `${base}/status`, done: true },
        { label: "RAG Status", href: `${base}/rag-status`, done: false },
      ],
    },
    {
      heading: "AI Hub",
      icon: Sparkles,
      items: [
        { label: "AI Document Processing", href: `${base}/ai-hub/document-processing`, done: true },
      ],
    },
  ];
}

// Forwards the current ?period= (if any) onto every link, same as
// project-nav.tsx's NavLinks. Split out because useSearchParams requires a
// Suspense boundary at prerender.
function NavLinks({ groups, pathname }: { groups: NavGroup[]; pathname: string }) {
  const searchParams = useSearchParams();
  const period = searchParams.get("period");
  const suffix = period ? `?period=${period}` : "";

  return (
    <nav className="mt-4 flex flex-col gap-2">
      {groups.map((group) => (
        <div key={group.heading}>
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-bold text-slate-800">
            <group.icon className="size-5 shrink-0 text-[#1a6fc4]" />
            {group.heading}
          </div>
          <div className="mt-1 mb-1 ml-5 flex flex-col gap-0.5 border-l border-slate-200 pl-3">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={`${item.href}${suffix}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(childClass, active ? activeClass : idleClass)}
                >
                  {item.label}
                  <StatusIcon done={item.done} />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AccountNav() {
  const pathname = usePathname();
  const { accountId } = useParams<{ accountId: string }>();
  const groups = buildGroups(`/account-reporting/${accountId}`);

  // The hub page (/account-reporting/:accountId) is a menu of cards linking
  // into each reporting area — this nav doesn't apply there, same as
  // ProjectNav's isHub check.
  const isHub = pathname === `/account-reporting/${accountId}`;
  if (isHub) return null;

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white px-4 py-8">
      <p className="flex items-center gap-2 px-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
        <CalendarDays className="size-4 text-[#1a6fc4]" />
        Period: {CURRENT_PERIOD}
      </p>

      <Suspense fallback={null}>
        <NavLinks groups={groups} pathname={pathname} />
      </Suspense>

      <p className="mt-6 flex flex-col gap-1.5 border-t border-slate-100 px-3 pt-4 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <CircleCheck className="size-3.5 text-emerald-500" />
          Completed this period
        </span>
        <span className="flex items-center gap-2">
          <Circle className="size-3.5 text-slate-300" />
          Pending
        </span>
      </p>
    </aside>
  );
}
