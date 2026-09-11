import type { Metadata } from "next";

import { ProjectDashboardRouter } from "@/components/project-dashboard/project-dashboard-router";

export const metadata: Metadata = {
  title: "Project Dashboard | Project Governance Tool",
};

export default function ProjectDashboardPage() {
  return <ProjectDashboardRouter />;
}
