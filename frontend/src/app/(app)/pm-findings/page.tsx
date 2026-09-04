import type { Metadata } from "next";

import { PmFindingsView } from "@/components/pm-findings/pm-findings-view";

export const metadata: Metadata = {
  title: "DE Findings | Project Governance Tool",
};

export default function PmFindingsPage() {
  return <PmFindingsView />;
}
