import type { Metadata } from "next";

import { StatusReviewPage } from "@/components/status-review/status-review-page";

export const metadata: Metadata = {
  title: "Project Review | Project Governance Tool",
};

export default function ProjectReviewPage() {
  return <StatusReviewPage scope="project" paramName="projectId" />;
}
