import type { Metadata } from "next";

import { AccountDeliveryCalendarHub } from "@/components/reporting/account-delivery-calendar-hub";

export const metadata: Metadata = {
  title: "Update Account Status Report | Governance One",
};

// Alternative, calendar-style landing page for Update Account Status Report. The
// original hub stays at /account-reporting/{id} for side-by-side comparison.
export default function ReportAccountStatusCalendarPage() {
  return <AccountDeliveryCalendarHub />;
}
