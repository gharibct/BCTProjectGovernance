import type { Metadata } from "next";

import { ProjectHealthAccountRag } from "@/components/dashboard/project-health-account-rag";

export const metadata: Metadata = { title: "Account RAG | Project Governance Tool" };

export default function AccountRagPage() {
  return <ProjectHealthAccountRag />;
}
