"use client";

import { useParams } from "next/navigation";

import { QueryErrorState } from "@/components/shared/query-error-state";
import { DeliveryCalendarView } from "@/components/reporting/delivery-calendar-view";
import { useGeos } from "@/lib/api/reference-data";
import {
  useRegionalReportingActivityForYear,
  useRegionalStatusReports,
} from "@/lib/api/regional-status";

// Landing page for Report Geo Status (weekly) — same calendar-style layout as
// Update Account Status Report, minus the Customer Communications section. Report
// Leadership Status reuses it, pointed at the Executive Update screen.
export function GeoDeliveryCalendarHub({
  title = "Report Geo Status",
  hrefFor = (geoId, periodId) => `/geo-reporting/${geoId}/status?period=${periodId}`,
}: {
  title?: string;
  hrefFor?: (geoId: string, periodId: string) => string;
} = {}) {
  const { geoId } = useParams<{ geoId: string }>();
  const { data: geos = [] } = useGeos();
  const reportsQuery = useRegionalStatusReports("geo", geoId ?? null);
  const { data: reports = [] } = reportsQuery;

  const thisYear = new Date().getFullYear();
  const current = useRegionalReportingActivityForYear("geo", geoId ?? null, thisYear);
  const previous = useRegionalReportingActivityForYear("geo", geoId ?? null, thisYear - 1);
  const weeklyItems = [...(previous.data?.weekly.items ?? []), ...(current.data?.weekly.items ?? [])];

  if (reportsQuery.isError) {
    return <QueryErrorState error={reportsQuery.error} onRetry={() => reportsQuery.refetch()} />;
  }

  return (
    <DeliveryCalendarView
      title={title}
      subtitle={geos.find((g) => g.id === geoId)?.name}
      weeklyItems={weeklyItems}
      reports={reports}
      baselineMode
      hrefForPeriod={(periodId) => hrefFor(geoId, periodId)}
    />
  );
}
