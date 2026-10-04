"use client";

import { useParams } from "next/navigation";

import { QueryErrorState } from "@/components/shared/query-error-state";
import { DeliveryCalendarView } from "@/components/reporting/delivery-calendar-view";
import { useAccounts } from "@/lib/api/reference-data";
import {
  useRegionalReportingActivityForYear,
  useRegionalStatusReports,
} from "@/lib/api/regional-status";

// Alternative landing page for Report Account Status (weekly) — the original
// hub is components/reporting/regional-reporting-hub.tsx. Customer
// Communications (Account) is its own left-menu entry, not part of this page.
export function AccountDeliveryCalendarHub() {
  const { accountId } = useParams<{ accountId: string }>();
  const { data: accounts = [] } = useAccounts();
  const reportsQuery = useRegionalStatusReports("account", accountId ?? null);
  const { data: reports = [] } = reportsQuery;

  const thisYear = new Date().getFullYear();
  const current = useRegionalReportingActivityForYear("account", accountId ?? null, thisYear);
  const previous = useRegionalReportingActivityForYear("account", accountId ?? null, thisYear - 1);
  const weeklyItems = [...(previous.data?.weekly.items ?? []), ...(current.data?.weekly.items ?? [])];

  const account = accounts.find((a) => a.id === accountId);
  // No reporting can be done before the account's reporting start date.
  const reportingStart = account?.tool_effective_date ?? null;

  if (reportsQuery.isError) {
    return <QueryErrorState error={reportsQuery.error} onRetry={() => reportsQuery.refetch()} />;
  }

  return (
    <DeliveryCalendarView
      title="Report Account Status"
      subtitle={account?.name}
      weeklyItems={weeklyItems}
      reports={reports}
      hrefForPeriod={(periodId) => `/account-reporting/${accountId}/status?period=${periodId}`}
      scopeStart={reportingStart}
    />
  );
}
