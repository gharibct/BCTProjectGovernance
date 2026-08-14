import type { Metadata } from "next";

import { RegionalDashboardView } from "@/components/regional-reporting/dashboard-view";

export const metadata: Metadata = {
  title: "Geo Dashboard | Project Governance Tool",
};

export default function GeoDashboardPage() {
  return <RegionalDashboardView scope="geo" paramName="geoId" />;
}
