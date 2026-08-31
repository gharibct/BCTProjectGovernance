import type { Metadata } from "next";

import { PmMySummary } from "@/components/dashboard/pm-my-summary";

export const metadata: Metadata = {
  title: "My Summary | Project Governance Tool",
};

export default function ProjectManagerDashboardPage() {
  return <PmMySummary />;
}
