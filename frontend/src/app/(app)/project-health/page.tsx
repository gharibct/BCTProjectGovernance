import type { Metadata } from "next";

import { ProjectHealthDashboard } from "@/components/dashboard/project-health-dashboard";

export const metadata: Metadata = {
  title: "GovOne Dashboard",
};

export default function ProjectHealthDashboardPage() {
  return <ProjectHealthDashboard />;
}
