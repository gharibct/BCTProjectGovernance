import type { Metadata } from "next";

import { ProjectHealthFindings } from "@/components/dashboard/project-health-findings";

export const metadata: Metadata = { title: "Findings | Project Governance Tool" };

export default function FindingsPage() {
  return <ProjectHealthFindings />;
}
