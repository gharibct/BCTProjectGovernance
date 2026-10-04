import type { Metadata } from "next";

import { PendingApprovalsPage } from "@/components/status-review/pending-approvals-page";

export const metadata: Metadata = {
  title: "Approve Project Delivery Status | Governance One",
};

export default function ProjectApprovalListPage() {
  return <PendingApprovalsPage scope="projects" />;
}
