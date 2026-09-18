import type { Metadata } from "next";

import { ProjectHealthCommitments } from "@/components/dashboard/project-health-commitments";

export const metadata: Metadata = { title: "Commitments | Governance One" };

export default function CommitmentsPage() {
  return <ProjectHealthCommitments />;
}
