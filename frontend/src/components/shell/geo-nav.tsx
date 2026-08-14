"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { CalendarDays, Circle, CircleCheck, ClipboardList, LayoutGrid, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { CURRENT_PERIOD } from "@/components/shell/reporting-period-badge";
import { activeClass, childClass, idleClass, StatusIcon, type NavGroup } from "./nav-primitives";

// Mirrors account-nav.tsx's shell exactly, generalized for Geo Reporting.
// No RAG Status entry — Geo has no health-declaration model (see
// components/regional-reporting/dashboard-view.tsx's GeoAccountMatrixSection
// swap-in for the same reason).
function buildGroups(base: string): NavGroup[] {
  return [
    {
      heading: "Geo Reporting",
      icon: ClipboardList,
      items: [
        { label: "Status Reporting", href: `${base}/status`, done: true },
        { label: "Executive Update", href: `${base}/executive-update`, done: false },
      ],
    },
    {
      heading: "AI Hub",
      icon: Sparkles,
      items: [{ label: "Document Processing", href: `${base}/ai-hub/document-processing`, done: true }],
    },
  ];
}

// Forwards the current ?period= (if any) onto every link, same as
// account-nav.tsx's NavLinks. Split out because useSearchParams requires a
// Suspense boundary at prerender.
function NavLinks({ groups, pathname, base }: { groups: NavGroup[]; pathname: string; base: string }) {
  const searchParams = useSearchParams();
  const period = searchParams.get("period");
  const suffix = period ? `?period=${period}` : "";

  // Standalone entry (not part of a heading+items group like the ones
  // below) — the Geo Head's read-first counterpart to the CXO's Geo Review
  // screen, mirrors account-nav.tsx's "Account Dashboard".
  const dashboardHref = `${base}/dashboard`;
  const dashboardActive = pathname === dashboardHref;

  return (
    <nav className="mt-4 flex flex-col gap-2">
      <Link
        href={`${dashboardHref}${suffix}`}
        aria-current={dashboardActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-bold transition-colors",
          dashboardActive ? "bg-[#d9eafc] text-[#15406b]" : "text-slate-800 hover:bg-slate-100"
        )}
      >
        <LayoutGrid className="size-5 shrink-0 text-[#1a6fc4]" />
        Geo Dashboard
      </Link>

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

export function GeoNav() {
  const pathname = usePathname();
  const { geoId } = useParams<{ geoId: string }>();
  const base = `/geo-reporting/${geoId}`;
  const groups = buildGroups(base);

  // The hub page (/geo-reporting/:geoId) is a menu of cards linking into
  // each reporting area — this nav doesn't apply there, same as
  // AccountNav's isHub check.
  const isHub = pathname === base;
  if (isHub) return null;

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white px-4 py-8">
      <p className="flex items-center gap-2 px-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
        <CalendarDays className="size-4 text-[#1a6fc4]" />
        Period: {CURRENT_PERIOD}
      </p>

      <Suspense fallback={null}>
        <NavLinks groups={groups} pathname={pathname} base={base} />
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
