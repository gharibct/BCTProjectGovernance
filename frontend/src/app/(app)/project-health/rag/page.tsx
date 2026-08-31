import type { Metadata } from "next";

import { ProjectHealthRag } from "@/components/dashboard/project-health-rag";

export const metadata: Metadata = { title: "RAG | Project Governance Tool" };

export default function RagPage() {
  return <ProjectHealthRag />;
}
