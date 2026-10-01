import type { Metadata } from "next";

import { DeliveryStatusCalendarHub } from "@/components/project-reporting/delivery-status-calendar-hub";

export const metadata: Metadata = {
  title: "Report Delivery Status | Governance One",
};

// Alternative, calendar-style landing page for Report Delivery Status. The
// original hub stays at /project-reporting/{id}/delivery for side-by-side comparison.
export default function ReportDeliveryStatusCalendarPage() {
  return <DeliveryStatusCalendarHub />;
}
