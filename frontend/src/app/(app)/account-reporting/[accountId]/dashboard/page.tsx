import type { Metadata } from "next";

import { RegionalDashboardView } from "@/components/regional-reporting/dashboard-view";

export const metadata: Metadata = {
  title: "Preview Report and Submit | Governance One",
};

export default function AccountDashboardPage() {
  return <RegionalDashboardView scope="account" paramName="accountId" />;
}
