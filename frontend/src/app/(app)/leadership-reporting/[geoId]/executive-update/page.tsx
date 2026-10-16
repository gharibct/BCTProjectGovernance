import type { Metadata } from "next";

import { ExecutiveUpdateView } from "@/components/regional-reporting/executive-update-view";

export const metadata: Metadata = {
  title: "Update Leadership Status Report | Governance One",
};

export default function LeadershipExecutiveUpdatePage() {
  return <ExecutiveUpdateView />;
}
