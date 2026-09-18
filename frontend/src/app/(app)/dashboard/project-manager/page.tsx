import type { Metadata } from "next";

import { PmMySummary } from "@/components/dashboard/pm-my-summary";

export const metadata: Metadata = {
  title: "My Summary | Governance One",
};

export default function ProjectManagerDashboardPage() {
  return <PmMySummary />;
}
