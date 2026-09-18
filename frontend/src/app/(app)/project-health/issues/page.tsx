import type { Metadata } from "next";

import { ProjectHealthIssues } from "@/components/dashboard/project-health-issues";

export const metadata: Metadata = { title: "Issues | Governance One" };

export default function IssuesPage() {
  return <ProjectHealthIssues />;
}
