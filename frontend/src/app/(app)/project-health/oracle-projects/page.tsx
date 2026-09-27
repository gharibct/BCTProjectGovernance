import type { Metadata } from "next";

import { ProjectHealthOracleProjects } from "@/components/dashboard/project-health-oracle-projects";

export const metadata: Metadata = { title: "Oracle Projects | Governance One" };

export default function ProjectHealthOracleProjectsPage() {
  return <ProjectHealthOracleProjects />;
}
