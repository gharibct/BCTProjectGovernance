import { Suspense } from "react";
import type { Metadata } from "next";

import { DeAccountFindingsView } from "@/components/de-account-audit/de-account-findings-view";

export const metadata: Metadata = {
  title: "Account Findings | Governance One",
};

// useSearchParams (the ?account= pre-filter) needs a Suspense boundary.
export default function DeAccountFindingsPage() {
  return (
    <Suspense fallback={null}>
      <DeAccountFindingsView />
    </Suspense>
  );
}
