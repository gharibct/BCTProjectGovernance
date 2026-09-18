import type { Metadata } from "next";

import { ProjectHealthFindings } from "@/components/dashboard/project-health-findings";

export const metadata: Metadata = { title: "Findings | Governance One" };

export default function FindingsPage() {
  return <ProjectHealthFindings />;
}
