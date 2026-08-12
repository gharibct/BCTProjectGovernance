import type { Metadata } from "next";

import { GeoHeadDashboard } from "@/components/dashboard/geo-head-dashboard";

export const metadata: Metadata = {
  title: "Geo Head Dashboard | Project Governance Tool",
};

export default function GeoHeadDashboardPage() {
  return <GeoHeadDashboard />;
}
