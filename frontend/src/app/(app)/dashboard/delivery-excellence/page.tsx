import type { Metadata } from "next";

import { DeMySummary } from "@/components/dashboard/de-my-summary";

export const metadata: Metadata = {
  title: "My Summary | Governance One",
};

export default function DeliveryExcellenceDashboardPage() {
  return <DeMySummary />;
}
