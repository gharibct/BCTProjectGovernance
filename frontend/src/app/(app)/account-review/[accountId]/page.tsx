import type { Metadata } from "next";

import { StatusReviewPage } from "@/components/status-review/status-review-page";

export const metadata: Metadata = {
  title: "Account Review | Project Governance Tool",
};

export default function AccountReviewPage() {
  return <StatusReviewPage scope="account" paramName="accountId" />;
}
