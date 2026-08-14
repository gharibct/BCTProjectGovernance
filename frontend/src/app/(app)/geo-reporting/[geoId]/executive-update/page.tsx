import type { Metadata } from "next";

import { ExecutiveUpdateView } from "@/components/regional-reporting/executive-update-view";

export const metadata: Metadata = {
  title: "Geo Reporting — Executive Update | Project Governance Tool",
};

export default function GeoExecutiveUpdatePage() {
  return <ExecutiveUpdateView />;
}
