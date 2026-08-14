import type { Metadata } from "next";

import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = {
  title: "My Summary | Project Governance Tool",
};

export default function DashboardPage() {
  return <Dashboard />;
}
