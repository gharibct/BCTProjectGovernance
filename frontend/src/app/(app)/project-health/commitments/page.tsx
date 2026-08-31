import type { Metadata } from "next";

import { ProjectHealthCommitments } from "@/components/dashboard/project-health-commitments";

export const metadata: Metadata = { title: "Commitments | Project Governance Tool" };

export default function CommitmentsPage() {
  return <ProjectHealthCommitments />;
}
