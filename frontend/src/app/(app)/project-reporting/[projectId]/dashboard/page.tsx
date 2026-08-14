import type { Metadata } from "next";

import { ProjectDashboardView } from "@/components/project-dashboard/project-dashboard-view";

export const metadata: Metadata = {
  title: "Project Dashboard | Project Governance Tool",
};

export default function ProjectDashboardPage() {
  return <ProjectDashboardView />;
}
