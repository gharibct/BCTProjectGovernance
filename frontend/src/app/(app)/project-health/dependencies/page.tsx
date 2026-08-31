import type { Metadata } from "next";

import { ProjectHealthDependencies } from "@/components/dashboard/project-health-dependencies";

export const metadata: Metadata = { title: "Dependencies | Project Governance Tool" };

export default function DependenciesPage() {
  return <ProjectHealthDependencies />;
}
