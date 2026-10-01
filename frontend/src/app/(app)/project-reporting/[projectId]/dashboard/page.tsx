import type { Metadata } from "next";

import { ProjectDashboardRouter } from "@/components/project-dashboard/project-dashboard-router";

export const metadata: Metadata = {
  title: "Preview Report and Submit | Governance One",
};

export default function ProjectDashboardPage() {
  return <ProjectDashboardRouter />;
}
