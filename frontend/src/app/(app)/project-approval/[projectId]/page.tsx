import type { Metadata } from "next";

import { StatusReviewPage } from "@/components/status-review/status-review-page";

export const metadata: Metadata = {
  title: "Approve Project Delivery Status | Governance One",
};

// The Account Manager's worklist copy of Project Delivery Status: same report as
// /project-review/[projectId], plus the Approve / Reject bar.
export default function ProjectApprovalPage() {
  return <StatusReviewPage scope="project" paramName="projectId" mode="approve" />;
}
