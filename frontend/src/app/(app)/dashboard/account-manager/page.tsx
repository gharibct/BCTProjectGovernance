import type { Metadata } from "next";

import { AccountHeadMySummary } from "@/components/dashboard/account-head-my-summary";

export const metadata: Metadata = {
  title: "My Summary | Governance One",
};

export default function AccountManagerDashboardPage() {
  return <AccountHeadMySummary />;
}
