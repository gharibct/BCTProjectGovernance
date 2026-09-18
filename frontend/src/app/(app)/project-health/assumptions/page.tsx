import type { Metadata } from "next";

import { ProjectHealthAssumptions } from "@/components/dashboard/project-health-assumptions";

export const metadata: Metadata = { title: "Assumptions | Governance One" };

export default function AssumptionsPage() {
  return <ProjectHealthAssumptions />;
}
