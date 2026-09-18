import type { Metadata } from "next";

import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "My Summary | Governance One",
};

export default function CdoDashboardPage() {
  return (
    <DashboardView
      title="My Summary"
      subtitle="Portfolio-wide delivery health across every account and geo"
      scope={{}}
      rowScope="account"
    />
  );
}
