"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { DeliveryCalendarView } from "@/components/reporting/delivery-calendar-view";
import { useAccounts } from "@/lib/api/reference-data";
import {
  useRegionalReportingActivityForYear,
  useRegionalStatusReports,
} from "@/lib/api/regional-status";
import { cn } from "@/lib/utils";
import { useCustomerCommunications } from "@/lib/api/customer-communications";

// Alternative landing page for Report Account Status (weekly) — the original
// hub is components/reporting/regional-reporting-hub.tsx. Below the delivery
// calendar sit the Customer Communications month boxes with Add Communication
// to their right; the quarter KPIs live on the Customer Communications page.
// Customer communications always show the last 12 months, independent of the calendar range.
const COMMUNICATION_MONTHS = 12;
const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function AccountDeliveryCalendarHub() {
  const now = new Date();
  const { accountId } = useParams<{ accountId: string }>();
  const { data: accounts = [] } = useAccounts();
  const reportsQuery = useRegionalStatusReports("account", accountId ?? null);
  const { data: reports = [] } = reportsQuery;

  const thisYear = new Date().getFullYear();
  const current = useRegionalReportingActivityForYear("account", accountId ?? null, thisYear);
  const previous = useRegionalReportingActivityForYear("account", accountId ?? null, thisYear - 1);
  const weeklyItems = [...(previous.data?.weekly.items ?? []), ...(current.data?.weekly.items ?? [])];

  const { data: communications = [] } = useCustomerCommunications(accountId ?? null);
  const account = accounts.find((a) => a.id === accountId);
  const name = account?.name;
  // No reporting (or communication) can be done before the account's reporting start date.
  const reportingStart = account?.tool_effective_date ?? null;

  // Months (YYYY-MM) with at least one communication, and how many.
  const countByMonth = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of communications) {
      const key = c.reporting_date.slice(0, 7);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [communications]);

  if (reportsQuery.isError) {
    return <QueryErrorState error={reportsQuery.error} onRetry={() => reportsQuery.refetch()} />;
  }

  return (
    <DeliveryCalendarView
      title="Report Account Status"
      subtitle={name}
      weeklyItems={weeklyItems}
      reports={reports}
      hrefForPeriod={(periodId) => `/account-reporting/${accountId}/status?period=${periodId}`}
      scopeStart={reportingStart}
    >
      {() => (
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Customer Account Communicated</h2>
          <Button
            asChild
            className="h-10 gap-2 bg-[#1a4a7a] px-4 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            <Link href={`/account-reporting/${accountId}/customer-communications`}>
              <Plus className="size-4" />
              Add Communication
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <div className="grid min-w-0 flex-1 grid-cols-6 gap-2 sm:grid-cols-12">
            {Array.from({ length: COMMUNICATION_MONTHS }, (_, i) => {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
              const monthEndISO = `${key}-${String(monthEnd.getDate()).padStart(2, "0")}`;
              const beforeStart = reportingStart !== null && monthEndISO < reportingStart;
              const count = countByMonth.get(key) ?? 0;
              return (
                <div key={key} className="flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-slate-500">
                    {MONTH_NAMES[d.getMonth()]} {String(d.getFullYear()).slice(2)}
                  </span>
                  <span
                    title={
                      beforeStart
                        ? "Not applicable — before the reporting start date"
                        : count > 0
                          ? `${count} communication${count === 1 ? "" : "s"} shared`
                          : "No communication shared"
                    }
                    className={cn(
                      "flex h-10 w-full items-center justify-center rounded-md border text-sm font-semibold",
                      beforeStart
                        ? "border-slate-300 bg-slate-200 text-slate-500"
                        : count > 0
                          ? "border-emerald-600 bg-emerald-500 text-white"
                          : "border-slate-200 bg-white text-slate-400"
                    )}
                  >
                    {!beforeStart && count > 0 ? count : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="size-3.5 rounded-[3px] border border-emerald-600 bg-emerald-500" />
              Communication Shared
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3.5 rounded-[3px] border border-slate-200 bg-white" />
              None
            </span>
          </div>
        </div>
      </section>
      )}
    </DeliveryCalendarView>
  );
}
