"use client";

import { useSession } from "@/stores/session";
import { DashboardView } from "./dashboard-view";

export function AccountManagerDashboard() {
  const accountIds = useSession((s) => s.user?.account_ids ?? []);

  return (
    <DashboardView
      title="Account Manager Dashboard"
      subtitle="Delivery health across the accounts you own"
      scope={{ account_ids: accountIds }}
      rowScope="project"
    />
  );
}
