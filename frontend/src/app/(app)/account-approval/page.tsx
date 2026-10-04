import type { Metadata } from "next";

import { PendingApprovalsPage } from "@/components/status-review/pending-approvals-page";

export const metadata: Metadata = {
  title: "Approve Account Delivery Status | Governance One",
};

export default function AccountApprovalListPage() {
  return <PendingApprovalsPage scope="accounts" />;
}
