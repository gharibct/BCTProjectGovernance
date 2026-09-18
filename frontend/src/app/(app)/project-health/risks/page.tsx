import type { Metadata } from "next";

import { ProjectHealthRisks } from "@/components/dashboard/project-health-risks";

export const metadata: Metadata = { title: "Risks | Governance One" };

export default function RisksPage() {
  return <ProjectHealthRisks />;
}
