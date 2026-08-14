import type { Metadata } from "next";

import { AccountManagerDashboard } from "@/components/dashboard/account-manager-dashboard";

export const metadata: Metadata = {
  title: "My Summary | Project Governance Tool",
};

export default function AccountManagerDashboardPage() {
  return <AccountManagerDashboard />;
}
