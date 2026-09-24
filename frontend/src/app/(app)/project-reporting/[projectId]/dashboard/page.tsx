import type { Metadata } from "next";

import { ProjectDashboardRouter } from "@/components/project-dashboard/project-dashboard-router";

export const metadata: Metadata = {
  title: "Project Delivery Status | Governance One",
};

export default function ProjectDashboardPage() {
  return <ProjectDashboardRouter />;
}
