import type { Metadata } from "next";

import { RegionalDashboardView } from "@/components/regional-reporting/dashboard-view";

export const metadata: Metadata = {
  title: "Delivery Status Report - Account | Governance One",
};

export default function AccountDashboardPage() {
  return <RegionalDashboardView scope="account" paramName="accountId" />;
}
