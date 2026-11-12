import type { Metadata } from "next";

import { DeAccountAuditWorkspace } from "@/components/de-account-audit/de-account-audit-workspace";

export const metadata: Metadata = {
  title: "Account Assessment | Governance One",
};

export default function DeAccountAuditWorkspacePage() {
  return <DeAccountAuditWorkspace />;
}
