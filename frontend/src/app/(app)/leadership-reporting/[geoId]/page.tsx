"use client";

import { GeoDeliveryCalendarHub } from "@/components/reporting/geo-delivery-calendar-hub";

export default function LeadershipReportingPage() {
  return (
    <GeoDeliveryCalendarHub
      title="Update Leadership Status Report"
      hrefFor={(geoId, periodId) => `/leadership-reporting/${geoId}/executive-update?period=${periodId}`}
    />
  );
}
