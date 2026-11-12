import type { Metadata } from "next";

import { AccountFindingsView } from "@/components/de-account-audit/account-findings-view";

export const metadata: Metadata = {
  title: "Account DE Findings | Governance One",
};

export default function AccountFindingsPage() {
  return <AccountFindingsView />;
}
