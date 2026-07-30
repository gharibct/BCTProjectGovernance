import type { Metadata } from "next";

import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = {
  title: "Dashboard | Project Governance Tool",
};

export default function DashboardPage() {
  return <Dashboard />;
}
