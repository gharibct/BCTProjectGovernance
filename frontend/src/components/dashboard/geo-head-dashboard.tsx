"use client";

import { useSession } from "@/stores/session";
import { DashboardView } from "./dashboard-view";

export function GeoHeadDashboard() {
  const geoIds = useSession((s) => s.user?.geo_ids ?? []);

  return (
    <DashboardView
      title="My Summary"
      subtitle="Delivery health across the geo(s) you own"
      scope={{ geo_ids: geoIds }}
      rowScope="account"
    />
  );
}
