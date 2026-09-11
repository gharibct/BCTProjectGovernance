import type { Metadata } from "next";

import { ProjectPerformancePage } from "@/components/project-performance/project-performance-page";

export const metadata: Metadata = {
  title: "Project Performance Dashboard | Project Governance Tool",
};

export default function ProjectPerformanceRoute() {
  return <ProjectPerformancePage />;
}
