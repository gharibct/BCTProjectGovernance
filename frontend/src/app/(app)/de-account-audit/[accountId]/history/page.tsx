import type { Metadata } from "next";

import { DeAccountAuditHistory } from "@/components/de-account-audit/de-account-audit-history";

export const metadata: Metadata = {
  title: "Account Assessment History | Governance One",
};

export default function DeAccountAuditHistoryPage() {
  return <DeAccountAuditHistory />;
}
