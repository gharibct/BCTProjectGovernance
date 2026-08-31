import type { Metadata } from "next";

import { ProjectHealthRisks } from "@/components/dashboard/project-health-risks";

export const metadata: Metadata = { title: "Risks | Project Governance Tool" };

export default function RisksPage() {
  return <ProjectHealthRisks />;
}
