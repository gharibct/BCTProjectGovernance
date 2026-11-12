import type { Metadata } from "next";

import { DeAccountAuditQueue } from "@/components/de-account-audit/de-account-audit-queue";

export const metadata: Metadata = {
  title: "Account Assessment | Governance One",
};

export default function DeAccountAuditPage() {
  return <DeAccountAuditQueue />;
}
