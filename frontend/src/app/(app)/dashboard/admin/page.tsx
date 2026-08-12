import type { Metadata } from "next";

import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Admin Dashboard | Project Governance Tool",
};

export default function AdminDashboardPage() {
  return (
    <DashboardView
      title="Admin Dashboard"
      subtitle="Portfolio-wide delivery health across every account and geo"
      scope={{}}
      rowScope="account"
    />
  );
}
