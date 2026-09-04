import type { Metadata } from "next";

import { RegionalReportingHub } from "@/components/reporting/regional-reporting-hub";

export const metadata: Metadata = {
  title: "Geo Reporting | Project Governance Tool",
};

export default function GeoReportingPage() {
  return <RegionalReportingHub scope="geo" />;
}
