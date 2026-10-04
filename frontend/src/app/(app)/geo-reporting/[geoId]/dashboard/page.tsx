import type { Metadata } from "next";

import { RegionalDashboardView } from "@/components/regional-reporting/dashboard-view";

export const metadata: Metadata = {
  title: "Preview Report and Baseline | Governance One",
};

export default function GeoDashboardPage() {
  return <RegionalDashboardView scope="geo" paramName="geoId" />;
}
