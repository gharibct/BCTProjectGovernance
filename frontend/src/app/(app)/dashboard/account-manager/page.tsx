import type { Metadata } from "next";

import { AccountManagerDashboard } from "@/components/dashboard/account-manager-dashboard";

export const metadata: Metadata = {
  title: "Account Manager Dashboard | Project Governance Tool",
};

export default function AccountManagerDashboardPage() {
  return <AccountManagerDashboard />;
}
