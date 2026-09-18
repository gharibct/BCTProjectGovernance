import type { Metadata } from "next";

import { GovernanceReviewWorkspace } from "@/components/de-approval/governance-review-workspace";

export const metadata: Metadata = {
  title: "Project Governance Review | Governance One",
};

export default function GovernanceReviewWorkspacePage() {
  return <GovernanceReviewWorkspace />;
}
