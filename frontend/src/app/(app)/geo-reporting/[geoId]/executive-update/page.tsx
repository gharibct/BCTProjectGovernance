import type { Metadata } from "next";

import { ExecutiveUpdateView } from "@/components/regional-reporting/executive-update-view";

export const metadata: Metadata = {
  title: "Geo Reporting — Executive Update | Governance One",
};

export default function GeoExecutiveUpdatePage() {
  return <ExecutiveUpdateView />;
}
