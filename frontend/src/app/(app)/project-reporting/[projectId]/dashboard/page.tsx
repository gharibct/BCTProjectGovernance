import type { Metadata } from "next";

import { ProjectDashboardRouter } from "@/components/project-dashboard/project-dashboard-router";

export const metadata: Metadata = {
  title: "Delivery Status Report - Project | Governance One",
};

export default function ProjectDashboardPage() {
  return <ProjectDashboardRouter />;
}
