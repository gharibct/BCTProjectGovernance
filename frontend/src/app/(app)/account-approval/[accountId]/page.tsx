import type { Metadata } from "next";

import { StatusReviewPage } from "@/components/status-review/status-review-page";

export const metadata: Metadata = {
  title: "Approve Account Delivery Status | Governance One",
};

// The Geo Head's worklist copy of Account Delivery Status: same report as
// /account-review/[accountId], plus the Approve / Reject bar.
export default function AccountApprovalPage() {
  return <StatusReviewPage scope="account" paramName="accountId" mode="approve" />;
}
