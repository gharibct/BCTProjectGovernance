import type { Metadata } from "next";

import { ProjectHealthDependencies } from "@/components/dashboard/project-health-dependencies";

export const metadata: Metadata = { title: "Dependencies | Governance One" };

export default function DependenciesPage() {
  return <ProjectHealthDependencies />;
}
