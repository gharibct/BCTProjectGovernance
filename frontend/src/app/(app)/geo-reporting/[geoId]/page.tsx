import type { Metadata } from "next";

import { HubPage } from "@/components/regional-reporting/hub-page";

export const metadata: Metadata = {
  title: "Geo Reporting | Project Governance Tool",
};

export default function GeoReportingPage() {
  return <HubPage scope="geo" paramName="geoId" />;
}
