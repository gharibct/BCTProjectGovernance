import type { Metadata } from "next";

import { DeMySummary } from "@/components/dashboard/de-my-summary";

export const metadata: Metadata = {
  title: "My Summary | Project Governance Tool",
};

export default function DeliveryExcellenceDashboardPage() {
  return <DeMySummary />;
}
