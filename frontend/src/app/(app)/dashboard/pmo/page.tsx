import type { Metadata } from "next";

import { PmoMySummary } from "@/components/dashboard/pmo-my-summary";

export const metadata: Metadata = {
  title: "My Summary | Project Governance Tool",
};

export default function PmoDashboardPage() {
  return <PmoMySummary />;
}
