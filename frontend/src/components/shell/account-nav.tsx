"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { LayoutGrid } from "lucide-react";

import { AccountReportRail } from "@/components/account-reporting/account-report-rail";

// Account Reporting has one weekly flow: the long Delivery Status Report
// (status page) and Submit Report (dashboard route). Both share the Report
// Progress rail, so the right-hand side does not change between them.
export function AccountNav() {
  const pathname = usePathname();
  const { accountId } = useParams<{ accountId: string }>();
  const base = `/account-reporting/${accountId}`;

  // The hub page (/account-reporting/:accountId) is a menu of cards linking
  // into each reporting area — this nav doesn't apply there.
  if (pathname === base || pathname === `${base}/summary`) return null;

  // Record Account Presentation is launched straight from the left menu and
  // has no right-hand rail.
  if (pathname === `${base}/customer-communications`) return null;

  const statusPath = `${base}/status`;
  const submitPath = `${base}/dashboard`;
  if (pathname === statusPath || pathname === submitPath) {
    return (
      <Suspense fallback={<aside className="w-72 shrink-0 border-l border-slate-200 bg-white" />}>
        <AccountReportRail mode={pathname === submitPath ? "submit" : "status"} />
      </Suspense>
    );
  }

  // Other Account screens (e.g. Customer Communications): a single link back
  // to the report.
  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white px-4 py-8">
      <Suspense fallback={null}>
        <BackToReport statusPath={statusPath} />
      </Suspense>
    </aside>
  );
}

function BackToReport({ statusPath }: { statusPath: string }) {
  const period = useSearchParams().get("period");
  return (
    <Link
      href={period ? `${statusPath}?period=${period}` : statusPath}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-bold text-slate-800 transition-colors hover:bg-slate-100"
    >
      <LayoutGrid className="size-5 shrink-0 text-[#1a6fc4]" />
      Delivery Status Report
    </Link>
  );
}
