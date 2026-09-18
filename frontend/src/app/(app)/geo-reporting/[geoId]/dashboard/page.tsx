import type { Metadata } from "next";

import { RegionalDashboardView } from "@/components/regional-reporting/dashboard-view";

export const metadata: Metadata = {
  title: "Delivery Status Report - Geo | Governance One",
};

export default function GeoDashboardPage() {
  return <RegionalDashboardView scope="geo" paramName="geoId" />;
}
