import type { Metadata } from "next";

import { GeoHeadDashboard } from "@/components/dashboard/geo-head-dashboard";

export const metadata: Metadata = {
  title: "My Summary | Project Governance Tool",
};

export default function GeoHeadDashboardPage() {
  return <GeoHeadDashboard />;
}
