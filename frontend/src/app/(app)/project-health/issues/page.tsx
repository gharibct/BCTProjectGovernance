import type { Metadata } from "next";

import { ProjectHealthIssues } from "@/components/dashboard/project-health-issues";

export const metadata: Metadata = { title: "Issues | Project Governance Tool" };

export default function IssuesPage() {
  return <ProjectHealthIssues />;
}
