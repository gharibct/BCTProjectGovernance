import type { Metadata } from "next";

import { AccountDeliveryCalendarHub } from "@/components/reporting/account-delivery-calendar-hub";

export const metadata: Metadata = {
  title: "Report Account Status | Governance One",
};

// Alternative, calendar-style landing page for Report Account Status. The
// original hub stays at /account-reporting/{id} for side-by-side comparison.
export default function ReportAccountStatusCalendarPage() {
  return <AccountDeliveryCalendarHub />;
}
