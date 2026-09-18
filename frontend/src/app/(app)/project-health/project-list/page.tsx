import type { Metadata } from "next";

import { ProjectHealthProjectList } from "@/components/dashboard/project-health-project-list";

export const metadata: Metadata = { title: "Project List | Governance One" };

export default function ProjectListPage() {
  return <ProjectHealthProjectList />;
}
