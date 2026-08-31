import type { Metadata } from "next";

import { DeApprovalQueue } from "@/components/de-approval/de-approval-queue";

export const metadata: Metadata = {
  title: "DE Project Approval | Project Governance Tool",
};

export default function DeApprovalQueuePage() {
  return <DeApprovalQueue />;
}
