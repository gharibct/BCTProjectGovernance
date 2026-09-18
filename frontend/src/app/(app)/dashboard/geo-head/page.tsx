import type { Metadata } from "next";

import { GeoHeadMySummary } from "@/components/dashboard/geo-head-my-summary";

export const metadata: Metadata = {
  title: "My Summary | Governance One",
};

export default function GeoHeadDashboardPage() {
  return <GeoHeadMySummary />;
}
