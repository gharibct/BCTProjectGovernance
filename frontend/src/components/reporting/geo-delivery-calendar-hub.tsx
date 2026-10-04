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
// Report Account Status, minus the Customer Communications section.
export function GeoDeliveryCalendarHub() {
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
      title="Report Geo Status"
      subtitle={geos.find((g) => g.id === geoId)?.name}
      weeklyItems={weeklyItems}
      reports={reports}
      baselineMode
      hrefForPeriod={(periodId) => `/geo-reporting/${geoId}/status?period=${periodId}`}
    />
  );
}
