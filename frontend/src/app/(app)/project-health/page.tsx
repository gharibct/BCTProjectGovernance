import type { Metadata } from "next";

import { ProjectHealthDashboard } from "@/components/dashboard/project-health-dashboard";

export const metadata: Metadata = {
  title: "Project Health | Governance One",
};

export default function ProjectHealthDashboardPage() {
  return <ProjectHealthDashboard />;
}
