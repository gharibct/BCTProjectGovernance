import type { Metadata } from "next";

import { GeoHeadMySummary } from "@/components/dashboard/geo-head-my-summary";

export const metadata: Metadata = {
  title: "My Summary | Project Governance Tool",
};

export default function GeoHeadDashboardPage() {
  return <GeoHeadMySummary />;
}
