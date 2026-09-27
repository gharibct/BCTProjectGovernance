import type { Metadata } from "next";

import { AccountContextPage } from "@/components/project-context/account-context-page";

export const metadata: Metadata = {
  title: "Select Account | Governance One",
};

// /select-account/{menu entry id} — every account-level menu item lands here
// first; the segment says which screen to forward to once an account is chosen.
export default function SelectAccountPage() {
  return <AccountContextPage />;
}
