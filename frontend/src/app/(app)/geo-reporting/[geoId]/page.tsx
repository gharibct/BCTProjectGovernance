import type { Metadata } from "next";

import { GeoDeliveryCalendarHub } from "@/components/reporting/geo-delivery-calendar-hub";

export const metadata: Metadata = {
  title: "Report Geo Status | Governance One",
};

export default function GeoReportingPage() {
  return <GeoDeliveryCalendarHub />;
}
