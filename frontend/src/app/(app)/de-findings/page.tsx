import type { Metadata } from "next";

import { DeFindingsView } from "@/components/de-findings/de-findings-view";

export const metadata: Metadata = {
  title: "DE Findings | Project Governance Tool",
};

export default function DeFindingsPage() {
  return <DeFindingsView />;
}
