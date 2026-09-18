import type { Metadata } from "next";

import { DeFindingsView } from "@/components/de-findings/de-findings-view";

export const metadata: Metadata = {
  title: "DE Findings | Governance One",
};

export default function DeFindingsPage() {
  return <DeFindingsView />;
}
