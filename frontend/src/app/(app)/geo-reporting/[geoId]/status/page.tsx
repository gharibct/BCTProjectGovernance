import type { Metadata } from "next";

import { StatusPage } from "@/components/regional-reporting/status-page";

export const metadata: Metadata = {
  title: "Geo Status Report | Project Governance Tool",
};

export default function GeoStatusReportPage() {
  return <StatusPage scope="geo" paramName="geoId" />;
}
