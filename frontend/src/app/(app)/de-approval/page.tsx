import type { Metadata } from "next";

import { DeApprovalQueue } from "@/components/de-approval/de-approval-queue";

export const metadata: Metadata = {
  title: "Project Details Approval | Governance One",
};

export default function DeApprovalQueuePage() {
  return <DeApprovalQueue />;
}
