import type { Metadata } from "next";

import { ProjectHealthAccountRag } from "@/components/dashboard/project-health-account-rag";

export const metadata: Metadata = { title: "Account RAG | Governance One" };

export default function AccountRagPage() {
  return <ProjectHealthAccountRag />;
}
