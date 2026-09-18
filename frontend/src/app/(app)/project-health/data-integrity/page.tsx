import type { Metadata } from "next";

import { ProjectHealthDataIntegrity } from "@/components/dashboard/project-health-data-integrity";

export const metadata: Metadata = { title: "Data Integrity | Governance One" };

export default function DataIntegrityPage() {
  return <ProjectHealthDataIntegrity />;
}
