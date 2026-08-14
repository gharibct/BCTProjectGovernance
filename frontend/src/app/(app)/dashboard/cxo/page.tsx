import type { Metadata } from "next";

import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "My Summary | Project Governance Tool",
};

export default function CxoDashboardPage() {
  return (
    <DashboardView
      title="My Summary"
      subtitle="Portfolio-wide delivery health across every account and geo"
      scope={{}}
      rowScope="account"
    />
  );
}
